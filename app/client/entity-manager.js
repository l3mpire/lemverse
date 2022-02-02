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

const itemAddedToInventoryText = 'An object has been added to your inventory';

entityManager = {
  scene: undefined,
  previousNearestEntity: undefined,
  entities: {},
  entitiesToSpawn: [],

  init(scene) {
    this.scene = scene;
  },

  create(entity) {
    this.entitiesToSpawn.push(entity);
  },

  remove(entity) {
    const entityInstance = this.entities[entity._id];
    if (!entityInstance) return;

    entityInstance.destroy();
    delete this.entities[entity._id];
  },

  update(entity) {
    window.dispatchEvent(new CustomEvent(eventTypes.onEntityUpdated, { detail: { entity } }));
  },

  onInteraction(tiles, interactionPosition) {
    if (this.previousNearestEntity?.actionType === entityActionType.pickable) {
      const previousNearestEntityId = this.previousNearestEntity._id;
      const animation = entityAnimations.picked(Meteor.user().profile.x, Meteor.user().profile.y - 30);
      this.scene.tweens.add({
        targets: this.entities[previousNearestEntityId],
        ...animation,
        onComplete: () => Meteor.call('useEntity', previousNearestEntityId, () => lp.notif.success(itemAddedToInventoryText)),
      });

      return;
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

    const { player } = userManager;
    if (player) this.handleNearestEntityTooltip(player);
  },

  handleNearestEntityTooltip(position) {
    let nearestEntity = this.nearestEntity(position);
    if (nearestEntity && this.entityDistanceTo(nearestEntity, position) >= entityTooltipConfig.proximityRequired) nearestEntity = undefined;

    if (nearestEntity) {
      if (!this.previousNearestEntity) {
        characterPopIns.createOrUpdate(
          entityTooltipConfig.identifier,
          this.tooltipTextFromActionType(nearestEntity.actionType),
          { target: this.entities[nearestEntity._id], className: entityTooltipConfig.style, offset: nearestEntity.tooltipOffset },
        );
      }

      characterPopIns.popIns[entityTooltipConfig.identifier].setData('target', this.entities[nearestEntity._id] || nearestEntity);
      this.previousNearestEntity = nearestEntity;
    } else if (this.previousNearestEntity) {
      characterPopIns.destroyPopIn(entityTooltipConfig.identifier);
      this.previousNearestEntity = undefined;
    }
  },

  nearestEntity(position) {
    const entities = Entities.find().fetch();
    let nearestEntity;
    let previousDistance = Infinity;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const distance = this.entityDistanceTo(entity, position);
      if (distance < previousDistance) {
        nearestEntity = entity;
        previousDistance = distance;
      }
    }

    return nearestEntity;
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
    bootScene.loadSpritesAtRuntime(sprites, () => {
      entities.forEach(entity => {
        if (!entity.gameObject) return;

        const animateSpawn = entity.actionType === entityActionType.pickable;
        const startPosition = entity.y;
        const gameObject = this.scene.add.container(entity.x, startPosition);
        gameObject.setData('id', entity._id);
        gameObject.setDepth(entity.y);

        if (entity.gameObject.sprite) {
          const sprite = this.scene.add.sprite(0, 0, entity.gameObject.sprite.key);
          gameObject.add(sprite);
        }

        if (entity.gameObject.collide) this.scene.physics.world.enableBody(gameObject);

        if (animateSpawn) {
          const animation = entityAnimations.floating(0, startPosition - 20);
          this.scene.tweens.add({
            targets: gameObject,
            ...animation,
            onUpdate: () => gameObject.setDepth(gameObject.y + 20),
          });
        }

        this.entities[entity._id] = gameObject;
      });

      if (callback) callback();
    });
  },
};
