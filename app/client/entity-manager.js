entityManager = {
  entities: [],
  scene: undefined,
  firstEntity: undefined,

  init(scene) {
    this.scene = scene;
  },

  create() { },

  remove() { },

  update() { },

  onInteraction(tile) {
    const { levelId } = Meteor.user().profile;

    levelConfiguration.rooms.forEach(room => {
      room.entities.forEach(entity => {
        const isUsed = entity.coordinates.some(coordinate => tile.x === coordinate[0] && tile.y === coordinate[1]);
        if (isUsed) Meteor.call('switchEntityState', levelId, entity.name);
      });
    });
  },

  postUpdate() { },
};
