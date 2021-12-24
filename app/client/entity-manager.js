const entityTooltipConfig = {
  identifier: 'nearest-entity',
  proximityRequired: 150 ** 2, // Distance without using sqrt
  text: '<p>Press the key <b>u</b> to use</p>',
  style: 'tooltip with-arrow fade-in',
};

entityManager = {
  scene: undefined,
  previousNearestEntity: undefined,

  init(scene) {
    this.scene = scene;
  },

  create() { },

  remove() { },

  update(entity) {
    escapeA.update(entity);
  },

  onInteraction(tiles, interactionPosition) {
    const { levelId } = Meteor.user().profile;
    const entities = Entities.find().fetch();

    entities.forEach(entity => {
      if (this.isEntityTriggered(entity, interactionPosition)) Meteor.call('switchEntityState', levelId, entity.name);
    });
  },

  postUpdate() {
    escapeA.postUpdate();

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
          entityTooltipConfig.text,
          { target: nearestEntity, className: entityTooltipConfig.style },
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
};
