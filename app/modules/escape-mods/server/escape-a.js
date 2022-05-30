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

  switchEntityState(levelId, 'last-door', false);
};

const startPaintMode = levelId => {
  const level = Levels.findOne(levelId);
  if (level.paintStarted) return;

  Levels.update(levelId, { $set: { paintStarted: true } });
  Meteor.setTimeout(() => stopPaintMode(levelId), paintModeDuration);
};

Meteor.methods({
  startPaintMode(levelId) {
    check(levelId, String);
    startPaintMode(levelId); // todo: add hook on the entity collection to listen for state change and execute action
  },
  paintTile(levelId, x, y, index) {
    check(levelId, String);
    check([x, y, index], [Number]);

    Tiles.update({ levelId, x, y, index }, { $set: { 'metadata.paint': Meteor.userId() } });
  },
});
