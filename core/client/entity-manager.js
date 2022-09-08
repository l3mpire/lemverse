const entityAnimations = {
  spawn: (sprite, scene) => {
    sprite.scaleY = 1.35;
    sprite.scaleX = 0.75;
    scene.tweens.add({
      targets: sprite,
      scaleX: { value: 1, duration: 300, ease: 'Bounce.easeOut' },
      scaleY: { value: 1, duration: 300, ease: 'Bounce.easeOut' },
    });
  },
  floating: (_x, y) => ({
    y: { value: y, duration: 1300, ease: 'Sine.easeIn', yoyo: true, repeat: -1 },
  }),
  picked: (x, y) => ({
    y,
    x,
    scale: 0,
    duration: 200,
    angle: 180,
    repeat: 0,
    ease: 'Circular.easeIn',
  }),
};

const entityTooltipConfig = {
  identifier: 'nearest-entity',
  proximityRequired: 100 ** 2, // Distance without using sqrt
  style: 'tooltip with-arrow fade-in',
};

const entityCreatedThreshold = 1000; // In ms
const floatingDistance = 20;
const itemAddedToInventoryText = 'Item added to your inventory';
const itemAlreadyPickedText = 'Someone just picked up this item 😢';

entityManager = {
  scene: undefined,
  previousNearestEntity: undefined,
  shouldCheckNearestEntity: false,
  entities: {},

  init(scene) {
    this.scene = scene;
  },

  destroy() {
    this.entities = {};
    this.previousNearestEntity = undefined;
  },

  onDocumentAdded(entity) {
    this.spawnEntities([entity]);
  },

  onDocumentRemoved(entity) {
    const entityInstance = this.entities[entity._id];
    if (!entityInstance) return;

    entityInstance.destroy();
    delete this.entities[entity._id];
    window.dispatchEvent(new CustomEvent(eventTypes.onEntityRemoved, { detail: { entity } }));
  },

  onDocumentUpdated(newEntity, oldEntity) {
    const entityInstance = this.entities[newEntity._id];
    if (!entityInstance) return;

    const { gameObject } = newEntity;
    if (gameObject) {
      entityInstance
        .setPosition(newEntity.x, newEntity.y)
        .setScale(gameObject.scale || 1, Math.abs(gameObject.scale || 1));

      entityInstance.setData('customDepth', gameObject.depth);
    }

    if (newEntity.state !== oldEntity.state) this.updateEntityFromState(newEntity, newEntity.state);

    window.dispatchEvent(new CustomEvent(eventTypes.onEntityUpdated, { detail: { entity: newEntity } }));
  },

  updateEntityFromState(entity, stateName) {
    if (!entity.states) return false;
    const state = entity.states[stateName || entity.state];
    if (!state) return false;

    const entityInstance = this.entities[entity._id];
    if (!entityInstance) return false;

    if (state.sprite) {
      const sprite = entityInstance.getByName('main-sprite');
      if (sprite) {
        const color = state.sprite.tint || 0xffffff;
        sprite.setTint(color, color, color, color);
      }
    }

    if (state.animation) {
      const sprite = entityInstance.getByName('main-sprite');
      if (sprite) {
        const fullAnimationKey = `${entity.gameObject.sprite.key}-${state.animation}`;
        sprite.play(fullAnimationKey);
      }
    }

    if (state.text) {
      const text = entityInstance.getByName('main-text');
      if (text) {
        const color = state.text.tint || 0xffffff;
        text.setTint(color, color, color, color);
        text.setText(state.text.text || entity.state);
      }
    }

    if (state.collider && entityInstance.body) {
      entityInstance.body.enable = state.collider.enable ?? entityInstance.body.enable;
    }

    return true;
  },

  interactWithNearestEntity() {
    if (!this.previousNearestEntity || this.previousNearestEntity.actionType === entityActionType.none) return;

    if (!this.allowedToUseEntity(this.previousNearestEntity)) {
      lp.notif.error('Action not allowed.');
      return;
    }

    if (this.previousNearestEntity.actionType === entityActionType.pickable) {
      this.pickEntity(this.previousNearestEntity);
      return;
    }

    if (this.previousNearestEntity.action) {
      const [action, value] = this.previousNearestEntity.action.split(':');
      if (action === 'modal') Session.set('modal', { template: value, entity: this.previousNearestEntity });

      return;
    }

    Meteor.call('useEntity', this.previousNearestEntity?.entityId || this.previousNearestEntity._id, error => {
      if (error) lp.notif.error('Unable to use this for now');
    });
  },

  allowedToUseEntity(entity) {
    const user = Meteor.user();
    if (user.profile.guest) return false;

    if (!entity.requiredItems?.length) return true;

    const userItems = Object.keys(user.inventory || {});
    return entity.requiredItems.every(item => userItems.includes(item));
  },

  pickEntity(entity) {
    const { _id } = entity;

    const user = Meteor.user();
    const animation = entityAnimations.picked(user.profile.x, user.profile.y - 30);
    this.scene.tweens.add({
      targets: this.entities[_id],
      ...animation,
      onComplete: () => {
        Meteor.call('useEntity', _id, error => {
          if (error) { lp.notif.error(itemAlreadyPickedText); return; }

          lp.notif.success(itemAddedToInventoryText);
          this.handleNearestEntityTooltip(userManager.getControlledCharacter());
        });
      },
    });
  },

  postUpdate() {
    if (userManager.controlledCharacter?.wasMoving) this.shouldCheckNearestEntity = true;
  },

  fixedUpdate() {
    const { controlledCharacter } = userManager;
    if (!controlledCharacter) return;

    if (this.shouldCheckNearestEntity) {
      this.handleNearestEntityTooltip(controlledCharacter);
      this.shouldCheckNearestEntity = false;
    }

    Object.values(this.entities).forEach(entity => {
      const customDepth = entity.getData('customDepth');
      entity.setDepth(customDepth ?? entity.y);
    });
  },

  handleNearestEntityTooltip(position) {
    let nearestEntity = this.nearestEntity(position, true);
    if (nearestEntity && this.entityDistanceTo(nearestEntity, position) >= entityTooltipConfig.proximityRequired) nearestEntity = undefined;

    if (nearestEntity) {
      if (nearestEntity === this.previousNearestEntity) return;

      if (!this.previousNearestEntity) {
        characterPopIns.createOrUpdate(
          entityTooltipConfig.identifier,
          this.tooltipTextFromActionType(nearestEntity.actionType),
          { className: entityTooltipConfig.style },
        );
      }

      const popIn = characterPopIns.popIns[entityTooltipConfig.identifier];
      popIn.setData('target', this.entities[nearestEntity._id] || nearestEntity);
      popIn.setData('offset', nearestEntity.tooltipOffset || this.computeTooltipPosition(nearestEntity));

      this.previousNearestEntity = nearestEntity;
    } else if (this.previousNearestEntity) {
      characterPopIns.destroyPopIn(entityTooltipConfig.identifier);
      this.previousNearestEntity = undefined;
    }
  },

  nearestEntity(position, ignoreNonInteractive = false) {
    const entities = Object.values(this.entities);
    let nearestEntity;
    let previousDistance = Infinity;
    entities.forEach(entity => {
      if (ignoreNonInteractive && entity.getData('actionType') === entityActionType.none) return;

      const distance = this.entityDistanceTo(entity, position);
      if (distance > previousDistance) return;
      nearestEntity = entity.getData('id');
      previousDistance = distance;
    });

    return nearestEntity ? Entities.findOne(nearestEntity) : undefined;
  },

  entityDistanceTo(entity, position) {
    return (position.x - entity.x) ** 2 + (position.y - entity.y) ** 2;
  },

  tooltipTextFromActionType(actionType) {
    if (actionType === entityActionType.none || !actionType) return '';
    if (actionType === entityActionType.actionable) return 'Press the key <b>u</b> to use';
    if (actionType === entityActionType.pickable) return 'Press the key <b>u</b> to pick';

    throw new Error('entity action not implemented');
  },

  entityToGameObject(entity) {
    const gameObject = this.scene.add.container(entity.x, entity.y)
      .setData('id', entity._id)
      .setData('actionType', entity.actionType)
      .setData('customDepth', entity.gameObject?.depth)
      .setScale(entity.gameObject?.scale || 1);

    this.entities[entity._id] = gameObject;

    if (!entity.gameObject) return undefined;

    let mainSprite;
    const { collider, sprite, animations, text } = entity.gameObject;
    if (sprite) {
      mainSprite = this.spawnSpriteFromConfig(sprite);
      gameObject.add(mainSprite);

      if (animations) this.createAnimationsFromConfig(sprite, animations);
    }

    // configuration: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/bitmaptext/
    if (text) gameObject.add(this.spawnTextFromConfig(text, entity.state));

    // configuration: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/arcade-body/
    if (collider) this.spawnColliderFromConfig(gameObject, collider);

    // pickable/loots animations
    const pickable = entity.actionType === entityActionType.pickable;
    if (pickable && mainSprite) {
      const animation = entityAnimations.floating(0, -floatingDistance);
      this.scene.tweens.add({
        targets: mainSprite,
        ...animation,
        onUpdate: () => gameObject.setDepth(gameObject.y + floatingDistance),
      });

      const shadow = createFakeShadow(this.scene, 0, floatingDistance, 0.3, 0.15);
      gameObject.add(shadow);

      this.scene.tweens.add({
        targets: shadow,
        scaleX: { value: 0.25, duration: 1300, ease: 'Sine.easeIn', yoyo: true, repeat: -1 },
        scaleY: { value: 0.1, duration: 1300, ease: 'Sine.easeIn', yoyo: true, repeat: -1 },
      });

      mainSprite.setOrigin(0.5, 1);
    } else if (mainSprite && this.isEntityRecentlyCreated(entity)) {
      entityAnimations.spawn(mainSprite, this.scene);
    }

    return gameObject;
  },

  spawnEntities(entities, callback) {
    const sprites = entities.map(entity => entity.gameObject?.sprite).filter(Boolean);

    const bootScene = game.scene.getScene('BootScene');
    bootScene.loadImagesAtRuntime(sprites, () => {
      entities.forEach(entity => {
        if (this.entities[entity._id]) return;

        // the spawn being asynchronous, an entity may have disappeared before being created
        if (!Entities.findOne(entity._id)) return;

        const gameObject = this.entityToGameObject(entity);

        this.updateEntityFromState(entity, entity.state);
        window.dispatchEvent(new CustomEvent(eventTypes.onEntityAdded, { detail: { entity, gameObject } }));
      });

      if (callback) callback();
    });
  },

  createAnimationsFromConfig(sprite, config) {
    Object.entries(config).forEach(([key, animConfig]) => {
      this.scene.anims.create({
        key: `${sprite.key}-${key}`,
        frames: this.scene.anims.generateFrameNames(sprite.key, { ...animConfig }),
        frameRate: animConfig.framerate || 16,
        repeat: animConfig.repeat,
      });
    });
  },

  spawnColliderFromConfig(gameObject, config) {
    this.scene.physics.add.existing(gameObject);

    const { body } = gameObject;
    const { radius, width, height, x, y, immovable, bounce, dragX, dragY, damping, worldBounds, collideTilemap } = config;

    if (radius) body.setCircle(radius);
    else body.setSize(width || 1, height || 1);

    body.immovable = immovable ?? true;
    body.setOffset(x || 0, y || 0);
    body.setBounce(bounce || 0.1);
    body.setAllowDrag();
    body.setDragX(dragX || 0.15);
    body.setDragY(dragY || 0.15);
    body.useDamping = damping ?? true;
    body.collideWorldBounds = true;
    body.allowGravity = worldBounds || false;
    body.enable = true;

    if (collideTilemap) {
      levelManager.layers.forEach(layer => this.scene.physics.add.collider(gameObject, layer));
    }

    this.scene.physics.add.collider(userManager.getControlledCharacter(), gameObject);
  },

  spawnSpriteFromConfig(config) {
    let sprite;

    if (config.assetId) sprite = this.scene.add.sprite(0, 0, config.assetId, config.key);
    else sprite = this.scene.add.sprite(0, 0, config.key);
    sprite.name = 'main-sprite';
    sprite.y = config.y || 0;
    sprite.setOrigin(0.5, 1);

    // animations
    if (!config.framerate) return sprite;

    const animation = this.scene.anims.create({
      key: config.key,
      frames: this.scene.anims.generateFrameNumbers(config.key),
      frameRate: config.framerate || 16,
    });

    if (animation.frames.length) sprite.play({ key: config.key, repeat: config.repeat ?? -1 });

    return sprite;
  },

  spawnTextFromConfig(config, defaultText = '') {
    const text = this.scene.make.text({ ...config, add: true });
    text.name = 'main-text';
    text.setScale(config.scale || 1);
    text.setOrigin(0.5, 0.5);

    if (!text.text) text.setText(defaultText);

    return text;
  },

  computeTooltipPosition(entity) {
    const gameObject = this.entities[entity._id];
    if (!gameObject) return { x: 0, y: 0 };

    const mainSprite = gameObject.getByName('main-sprite');
    if (!mainSprite) return { x: 0, y: 0 };
    const pickable = entity.actionType === entityActionType.pickable;

    return { x: 0, y: -(mainSprite.displayHeight + (pickable ? floatingDistance : 0)) };
  },

  isEntityRecentlyCreated(entity) {
    return Date.now() - entity.createdAt.getTime() <= entityCreatedThreshold;
  },
};
