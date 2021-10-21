const paintModeDuration = 30000;

const stopPaintMode = levelId => {
  const scoresPerUser = _.groupBy(Tiles.find({ 'metadata.paint': { $exists: true },
    levelId,
    x: { $gte: 61, $lte: 83 },
    y: { $gte: 51, $lte: 67 },
  }).fetch(), 'metadata.paint');

  _.each(scoresPerUser, (tiles, userId) => {
    Meteor.users.update(userId, { $set: { 'profile.escape.score': tiles.length } });
  });

  // eslint-disable-next-line no-use-before-define
  switchEntityStateLogic(levelId, 'last-door', false);
};

const startPaintMode = levelId => {
  const level = Levels.findOne(levelId);
  if (level.paintStarted) return;

  Levels.update(levelId, { $set: { paintStarted: true } });
  Meteor.setTimeout(() => stopPaintMode(levelId), paintModeDuration);
};

const switchEntityStateLogic = (levelId, name, forcedState = undefined) => {
  check([levelId, name], [String]);
  const entity = findEntity(name);
  if (!entity) return;

  const entityDocument = Entities.findOne({ levelId, name });
  const newState = forcedState !== undefined ? forcedState : !entityDocument.state;
  const state = newState ? entity.states[1] : entity.states[0];

  state.remove?.forEach(t => {
    Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index });
  });

  state.add?.forEach(t => {
    Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() });
  });

  state.replace?.forEach(t => {
    Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } });
  });

  Entities.update({ levelId, name }, { $set: { state: newState } });

  if (name === 'room-4-ready') startPaintMode(levelId);
};

Meteor.methods({
  switchEntityState(levelId, name, forcedState = undefined) {
    switchEntityStateLogic(levelId, name, forcedState);
  },
  paintTile(levelId, x, y, index) {
    Tiles.update({ levelId, x, y, index }, { $set: { 'metadata.paint': Meteor.userId() } });
  },
});
