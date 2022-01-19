createLevel = (templateId = undefined, newName = undefined) => {
  const newLevelId = Levels.id();
  Levels.insert({
    _id: newLevelId,
    name: newName || `${Meteor.user().profile.name || Meteor.user().username}'s world`,
    spawn: { x: 200, y: 200 },
    createdAt: new Date(),
    createdBy: Meteor.userId(),
  });

  if (templateId) {
    const templateLevel = Levels.findOne(templateId);
    Levels.update({ _id: newLevelId }, { $set: { template: false, metadata: templateLevel.metadata } });
    if (templateLevel.spawn) Levels.update({ _id: newLevelId }, { $set: { spawn: templateLevel.spawn } });

    const tiles = Tiles.find({ levelId: templateId }).fetch();
    const zones = Zones.find({ levelId: templateId }).fetch();

    tiles.forEach(tile => {
      Tiles.insert({
        ...tile,
        _id: Tiles.id(),
        createdAt: new Date(),
        createdBy: Meteor.userId(),
        levelId: newLevelId,
      });
    });

    zones.forEach(zone => {
      Zones.insert({
        ...zone,
        _id: Zones.id(),
        createdAt: new Date(),
        createdBy: Meteor.userId(),
        levelId: newLevelId,
      });
    });
  } else {
    const { levelId } = Meteor.user().profile;

    Zones.insert({
      _id: Zones.id(),
      adminOnly: false,
      createdAt: new Date(),
      createdBy: Meteor.userId(),
      levelId: newLevelId,
      targetedLevelId: levelId,
      name: 'Previous world',
      x1: 10,
      x2: 110,
      y1: 10,
      y2: 110,
    });
  }

  return newLevelId;
};

deleteLevel = levelId => {
  log('deleteLevel: start', { levelId });

  const numLevels = Levels.find().count();
  if (numLevels === 1) {
    error('deleteLevel: can not delete last level');
    throw new Meteor.Error('not-allowed', 'Can not delete last level');
  }

  Entities.remove({ levelId });
  Zones.remove({ levelId });
  Tiles.remove({ levelId });
  Levels.remove({ _id: levelId });
  Meteor.users.update({ 'profile.levelId': levelId }, { $set: { 'profile.levelId': Meteor.settings.defaultLevelId } }, { multi: true });
};

// eslint-disable-next-line no-undef
setSpawnLevelXY = () => {
  const user = Meteor.user();
  log('setSpawnLevelXY: start', { userId: user._id });
  if (!user) return;
  Levels.update({ _id: user.profile.levelId }, { $set: { spawn: { x: user.profile.x, y: user.profile.y } } });
};

Meteor.publish('levels', function () {
  if (!this.userId) return undefined;

  return Levels.find({ }, { fields: { name: 1, hide: 1, visit: 1 } });
});

Meteor.publish('currentLevel', function () {
  if (!this.userId) return undefined;

  return Levels.find(
    { _id: Meteor.user().profile.levelId || Meteor.settings.defaultLevelId },
    { fields: { name: 1, spawn: 1, hide: 1, height: 1, width: 1 } },
  );
});

Meteor.methods({
  toggleLevelEditionPermission(userId) {
    check(userId, String);
    if (!isEditionAllowed(this.userId)) return;

    const { levelId } = Meteor.user().profile;
    if (!isEditionAllowed(userId)) Levels.update(levelId, { $addToSet: { editorUserIds: { $each: [userId] } } });
    else Levels.update(levelId, { $pull: { editorUserIds: userId } });
  },
  createLevel(templateId = undefined) {
    return createLevel(templateId);
  },
  updateLevel(name, position, hide) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(name, String);
    check(position, { x: Number, y: Number });
    check(hide, Boolean);

    const { levelId } = Meteor.user().profile;
    const level = Levels.findOne(levelId);
    if (!level || level.sandbox) throw new Meteor.Error('invalid-level', 'A valid level is required');
    if (!isEditionAllowed(this.userId)) throw new Meteor.Error('permission-error', `You can't edit this level`);

    Levels.update(levelId, { $set: { name, spawn: { x: position.x, y: position.y }, hide } });
  },
  increaseLevelVisits(levelId) {
    check(levelId, String);
    Levels.update({ _id: levelId, createdBy: { $ne: Meteor.userId() } }, { $inc: { visit: 1 } });
  },
});
