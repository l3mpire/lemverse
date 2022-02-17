const entityAnimations = {
  drop: (x, y) => ({
    y,
    duration: 500,
    repeat: 0,
    ease: 'Bounce.easeOut',
  }),
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

const floatingDistance = 20;
const itemAddedToInventoryText = 'Item added to your inventory';
const itemAlreadyPickedText = 'Someone just picked up this item 😢';

entityManager = {
  scene: undefined,
  previousNearestEntity: undefined,
  entities: {},
  entitiesToSpawn: [],

  init(scene) {
    this.scene = scene;
  },

  destroy() {
    this.onSleep();
    this.entities = {};
    this.entitiesToSpawn = [];
    this.previousNearestEntity = undefined;
  },

  onSleep() { },

  onDocumentAdded(entity) {
    this.entitiesToSpawn.push(entity);
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

    entityInstance.setPosition(newEntity.x, newEntity.y);

    if (newEntity.states && newEntity.state !== oldEntity.state) {
      const state = newEntity.states[newEntity.state];
      this.updateEntityFromState(newEntity, state);
    }

    window.dispatchEvent(new CustomEvent(eventTypes.onEntityUpdated, { detail: { entity: newEntity } }));
  },

  updateEntityFromState(entity, state) {
    const entityInstance = this.entities[entity._id];
    if (!entityInstance || !state) return;

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
  },

  onInteraction(tiles, interactionPosition) {
    if (!this.previousNearestEntity || this.previousNearestEntity.actionType === entityActionType.none) return;
    if (Meteor.user().profile.guest) return;

    if (this.previousNearestEntity.actionType === entityActionType.pickable) {
      const previousNearestEntityId = this.previousNearestEntity._id;
      const animation = entityAnimations.picked(Meteor.user().profile.x, Meteor.user().profile.y - 30);
      this.scene.tweens.add({
        targets: this.entities[previousNearestEntityId],
        ...animation,
        onComplete: () => {
          Meteor.call('useEntity', previousNearestEntityId, error => {
            if (error) lp.notif.error(itemAlreadyPickedText);
            else lp.notif.success(itemAddedToInventoryText);
          });
        },
      });

      return;
    }

    if (this.previousNearestEntity.action) {
      const [action, value] = this.previousNearestEntity.action.split(':');
      if (action === 'modal') Session.set('modal', { template: value });
    }

    Entities.find().fetch().forEach(entity => {
      if (this.isEntityTriggered(entity, interactionPosition)) Meteor.call('useEntity', entity._id);
    });
  },

  postUpdate() {
    escapeA.postUpdate();

    if (this.entitiesToSpawn.length) {
      const clonedEntities = [...this.entitiesToSpawn];
      this.entitiesToSpawn = [];
      this.spawnEntities(clonedEntities);
    }

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
        // the spawn being asynchronous, an entity may have disappeared before being created
        if (!Entities.findOne(entity._id)) return;

        const pickable = entity.actionType === entityActionType.pickable;
        const gameObject = this.scene.add.container(entity.x, entity.y);
        gameObject.setData('id', entity._id);
        gameObject.setData('actionType', entity.actionType);
        gameObject.setDepth(entity.y);
        this.entities[entity._id] = gameObject;

        if (!entity.gameObject) return;

        let mainSprite;
        if (entity.gameObject.sprite) {
          mainSprite = this.scene.add.sprite(0, 0, entity.gameObject.sprite.key);
          mainSprite.name = 'main-sprite';
          mainSprite.setScale(entity.gameObject.sprite.scale || 1);
          gameObject.add(mainSprite);

          // play spritesheet animation
          if (entity.gameObject.sprite.framerate) {
            const animation = this.scene.anims.create({
              key: entity.gameObject.sprite.key,
              frames: this.scene.anims.generateFrameNumbers(entity.gameObject.sprite.key),
              frameRate: entity.gameObject.sprite.framerate || 16,
            });
            if (animation.frames.length) mainSprite.play({ key: entity.gameObject.sprite.key, repeat: -1 });
          }
        }

        if (entity.gameObject.text) {
          const mainText = this.scene.make.text({ x: 0, y: 0, ...entity.gameObject.text, add: true });
          mainText.name = 'main-text';
          mainText.setScale(entity.gameObject.text.scale || 1);
          mainText.setOrigin(0.5, 0.5);
          gameObject.add(mainText);

          if (!entity.gameObject.text.text) mainText.setText(entity.state);
        }

        if (entity.gameObject.collide) this.scene.physics.world.enableBody(gameObject);

        // pickable/loots animations
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
        }

        if (entity.states) this.updateEntityFromState(entity, entity.states[entity.state]);
      });

      if (callback) callback();
    });
  },

  computeTooltipPosition(entity) {
    const gameObject = this.entities[entity._id];
    if (!gameObject) return { x: 0, y: 0 };

    const mainSprite = gameObject.getByName('main-sprite');
    if (!mainSprite) return { x: 0, y: 0 };
    const pickable = entity.actionType === entityActionType.pickable;

    return { x: 0, y: -(mainSprite.displayHeight + (pickable ? floatingDistance : 0)) };
  },
};
