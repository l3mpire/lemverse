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
      Meteor.call('useEntity', this.previousNearestEntity._id, () => lp.notif.success(itemAddedToInventoryText));
      return;
    }

    Entities.find().fetch().forEach(entity => {
      if (this.isEntityTriggered(entity, interactionPosition)) Meteor.call('useEntity', entity._id);
    });
  },

  postUpdate() {
    escapeA.postUpdate();

    if (this.entitiesToSpawn.length) {
      this.spawnEntities(this.entitiesToSpawn);
      this.entitiesToSpawn = [];
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
          { target: nearestEntity, className: entityTooltipConfig.style, offset: nearestEntity.tooltipOffset },
        );
      }

      characterPopIns.popIns[entityTooltipConfig.identifier].setData('target', nearestEntity);
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

  spawnEntities(entities) {
    let sprites = entities.map(entity => entity.gameObject?.sprite);
    sprites = sprites.filter(Boolean);

    const bootScene = game.scene.getScene('BootScene');
    bootScene.loadSpritesAtRuntime(sprites, () => {
      entities.forEach(entity => {
        if (!entity.gameObject) return;
        const gameObject = this.scene.add.container(entity.x, entity.y);
        gameObject.setDepth(entity.y);

        if (entity.gameObject.sprite) {
          const sprite = this.scene.add.sprite(0, 0, entity.gameObject.sprite.key);
          gameObject.add(sprite);
        }

        if (entity.gameObject.collide) this.scene.physics.world.enableBody(gameObject);

        this.entities[entity._id] = gameObject;
      });
    });
  },
};
