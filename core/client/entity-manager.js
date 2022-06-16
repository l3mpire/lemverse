import Phaser from 'phaser';

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
  floating: (x, y) => ({
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

const entityInteractionConfiguration = {
  hitArea: new Phaser.Geom.Circle(0, 0, 20),
  hitAreaCallback: Phaser.Geom.Circle.Contains,
  cursor: 'pointer',
  draggable: true,
};

const onDrag = function (pointer, dragX, dragY) {
  this.x = dragX;
  this.y = dragY;
  this.setDepth(this.y);
};

const onDragEnd = function () { Entities.update(this.getData('id'), { $set: { x: this.x, y: this.y } }); };
const onPointerDown = function () { Session.set('selectedEntityId', this.getData('id')); };

const entityCreatedThreshold = 1000; // In ms
const floatingDistance = 20;
const itemAddedToInventoryText = 'Item added to your inventory';
const itemAlreadyPickedText = 'Someone just picked up this item 😢';

entityManager = {
  scene: undefined,
  previousNearestEntity: undefined,
  entities: {},

  init(scene) {
    this.scene = scene;
  },

  destroy() {
    this.onSleep();
    this.entities = {};
    this.previousNearestEntity = undefined;
  },

  onSleep() { },

  onDocumentAdded(entity) {
    this.spawnEntities([entity]);
  },

  onDocumentRemoved(entity) {
    const entityInstance = this.entities[entity._id];
    if (!entityInstance) return;

    entityInstance.destroy();
    delete this.entities[entity._id];
  },

  onDocumentUpdated(newEntity, oldEntity) {
    const entityInstance = this.entities[newEntity._id];
    if (!entityInstance) return;

    const { gameObject } = newEntity;
    if (gameObject) {
      entityInstance
        .setPosition(newEntity.x, newEntity.y)
        .setDepth(gameObject.depth || newEntity.y)
        .setScale(gameObject.scale || 1, Math.abs(gameObject.scale || 1));
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

        if (state.sprite.animation) {
          if (state.sprite.animation === 'pause') sprite.anims.pause();
          else sprite.anims.resume();
        }
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

    return true;
  },

  onInteraction(tiles, interactionPosition) {
    if (!this.previousNearestEntity || this.previousNearestEntity.actionType === entityActionType.none) return;

    const user = Meteor.user();
    if (user.profile.guest) return;
    if (!this.allowedToUseEntity(user, this.previousNearestEntity)) {
      lp.notif.error('You are not allowed to use this item.');
      return;
    }

    if (this.previousNearestEntity.actionType === entityActionType.pickable) {
      const previousNearestEntityId = this.previousNearestEntity._id;
      const animation = entityAnimations.picked(user.profile.x, user.profile.y - 30);
      this.scene.tweens.add({
        targets: this.entities[previousNearestEntityId],
        ...animation,
        onComplete: () => {
          Meteor.call('useEntity', previousNearestEntityId, error => {
            if (error) { lp.notif.error(itemAlreadyPickedText); return; }

            lp.notif.success(itemAddedToInventoryText);
            this.handleNearestEntityTooltip(userManager.player);
          });
        },
      });

      return;
    }

    if (this.previousNearestEntity.action) {
      const [action, value] = this.previousNearestEntity.action.split(':');
      if (action === 'modal') Session.set('modal', { template: value, entity: this.previousNearestEntity });
    }

    Entities.find().fetch().forEach(entity => {
      if (entity.states && this.isEntityTriggered(entity, interactionPosition)) Meteor.call('useEntity', entity._id);
    });
  },

  allowedToUseEntity(user, entity) {
    if (!entity.requiredItems?.length) return true;

    const userItems = Object.keys(user.inventory || {});
    return entity.requiredItems.every(item => userItems.includes(item));
  },

  postUpdate() {
    const { player, playerWasMoving } = userManager;
    if (player && playerWasMoving && !Meteor.user().profile.guest) this.handleNearestEntityTooltip(player);
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

  isEntityTriggered(entity, position) {
    const area = entity.triggerArea;
    if (!area) return false;

    if (position.x < entity.x + area.x) return false;
    if (position.x > entity.x + area.x + area.w) return false;
    if (position.y < entity.y + area.y) return false;
    if (position.y > entity.y + area.y + area.h) return false;

    return true;
  },

  tooltipTextFromActionType(actionType) {
    if (actionType === entityActionType.none || !actionType) return '';
    if (actionType === entityActionType.actionable) return 'Press the key <b>u</b> to use';
    if (actionType === entityActionType.pickable) return 'Press the key <b>u</b> to pick';

    throw new Error('entity action not implemented');
  },

  spawnEntities(entities, callback) {
    const sprites = entities.map(entity => entity.gameObject?.sprite).filter(Boolean);

    const bootScene = game.scene.getScene('BootScene');
    bootScene.loadImagesAtRuntime(sprites, () => {
      entities.forEach(entity => {
        if (this.entities[entity._id]) return;

        // the spawn being asynchronous, an entity may have disappeared before being created
        if (!Entities.findOne(entity._id)) return;

        const gameObject = this.scene.add.container(entity.x, entity.y)
          .setData('id', entity._id)
          .setData('actionType', entity.actionType)
          .setDepth(entity.gameObject?.depth || entity.y)
          .setScale(entity.gameObject?.scale || 1)
          .on('pointerdown', onPointerDown)
          .on('drag', onDrag)
          .on('dragend', onDragEnd);

        this.entities[entity._id] = gameObject;

        if (!entity.gameObject) return;

        let mainSprite;
        const { collide, sprite, text } = entity.gameObject;
        if (sprite) {
          mainSprite = this.spawnSpriteFromConfig(sprite);
          gameObject.add(mainSprite);
        }
        if (text) gameObject.add(this.spawnTextFromConfig(text, entity.state));
        if (collide) this.scene.physics.world.enableBody(gameObject);

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
        } else if (mainSprite && this.entityRecentlyCreated(entity)) {
          entityAnimations.spawn(mainSprite, this.scene);
        }

        this.updateEntityFromState(entity, entity.state);
      });

      // ensures spawned entities are editable if the entity editor is open
      if (Session.get('editor', 0) && Session.get('editorSelectedMenu') === editorModes.entities) this.enableEdition(true);

      if (callback) callback();
    });
  },

  spawnSpriteFromConfig(config) {
    let sprite;

    if (config.assetId) sprite = this.scene.add.sprite(0, 0, config.assetId, config.key);
    else sprite = this.scene.add.sprite(0, 0, config.key);
    sprite.name = 'main-sprite';

    // animations
    if (!config.framerate) return sprite;

    const animation = this.scene.anims.create({
      key: config.key,
      frames: this.scene.anims.generateFrameNumbers(config.key),
      frameRate: config.framerate || 16,
    });

    if (animation.frames.length) sprite.play({ key: config.key, repeat: -1 });

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

  enableEdition(value) {
    let func;
    if (value) func = key => this.entities[key].setInteractive(entityInteractionConfiguration);
    else func = key => this.entities[key].disableInteractive();

    Object.keys(this.entities).forEach(func);
  },

  entityRecentlyCreated(entity) {
    return Date.now() - entity.createdAt.getTime() <= entityCreatedThreshold;
  },
};
