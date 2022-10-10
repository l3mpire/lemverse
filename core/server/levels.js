import { canEditLevel, canEditActiveLevel, currentLevel } from '../lib/misc';

const defaultSpawnPosition = { x: 200, y: 200 };

const cloneLevelContent = (originalLevelId, targetedLevelId) => {
  log('cloneLevelContent: start', { originalLevelId, targetedLevelId });
  check([originalLevelId, targetedLevelId], [Match.Id]);

  const now = new Date();

  const { metadata, spawn, width, height, createdBy } = Levels.findOne(originalLevelId);
  Levels.update(targetedLevelId, {
    $set: {
      template: false,
      metadata,
      spawn: spawn || defaultSpawnPosition,
      width,
      height,
      templateId: originalLevelId,
    },
  });

  const tiles = Tiles.find({ levelId: originalLevelId }).fetch();
  tiles.forEach(tile => {
    Tiles.insert({
      ...tile,
      _id: Tiles.id(),
      createdAt: now,
      createdBy,
      levelId: targetedLevelId,
    });
  });

  const zones = Zones.find({ levelId: originalLevelId }).fetch();
  zones.forEach(zone => {
    Zones.insert({
      ...zone,
      _id: Zones.id(),
      createdAt: now,
      createdBy,
      levelId: targetedLevelId,
      uuid: undefined,
    });
  });

  const entities = Entities.find({ levelId: originalLevelId }).fetch();

  // Mapping between origin entityId and destination entityId
  const idMap = {};

  // Keep a waiting entity list in case of a trigger like element can be link to another trigger like element
  const waitingEntity = [];

  // Sort entities to put all entities without entityId key at the beginning
  // to avoid multiple loop
  entities.sort((a, b) => {
    if (a.entityId) {
      return 1;
    }
    if (b.entityId) {
      return -1;
    }
    return 0;
  });

  entities.forEach(entity => {
    // Don't care about pickable entities
    if (entity.actionType !== entityActionType.pickable) {
      const _id = Entities.id();
      idMap[entity._id] = _id;

      const newEntity = {
        ...entity,
        _id,
        createdAt: now,
        createdBy,
        levelId: targetedLevelId,
      };

      if (typeof newEntity.entityId === 'string' && typeof idMap[newEntity.entityId] !== 'string') {
        waitingEntity.push(newEntity);
      } else {
        if (typeof newEntity.entityId === 'string') {
          newEntity.entityId = idMap[newEntity.entityId];
        }
        Entities.insert(newEntity);
      }
    }
  });

  // In the most use case this list should be empty
  waitingEntity.forEach(entity => {
    if (typeof idMap[entity.entityId] === 'string') {
      entity.entityId = idMap[entity.entityId];
      Entities.insert(entity);
    } else {
      log('cloneLevelContent: Found entity with entityId without any match: ', entity);
    }
  });

  log('cloneLevelContent: done');
};

createLevel = options => {
  log('createLevel: start', { options });

  check(options.templateId, Match.Maybe(Match.Id));
  check(options.name, Match.Maybe(Match.SafeString));
  check(options.guildId, Match.Maybe(Match.Id));
  check(options.createdBy, Match.Maybe(Match.Id));

  const { createdBy, name, templateId } = options;
  const now = new Date();
  const user = createdBy ? Meteor.users.findOne(createdBy) : Meteor.user();

  const newLevelId = Levels.id();
  const levelName = name || `${user.profile.name || user.username}'s world`;
  Levels.insert({
    _id: newLevelId,
    name: levelName,
    spawn: defaultSpawnPosition,
    apiKey: CryptoJS.MD5(now + Random.hexString(48)).toString(),
    createdAt: now,
    createdBy: user._id,
  });

  if (templateId) cloneLevelContent(options.templateId, newLevelId);
  else {
    log('createLevel: create empty level');
    const { levelId } = user.profile;

    Zones.insert({
      _id: Zones.id(),
      adminOnly: false,
      createdAt: now,
      createdBy: user._id,
      levelId: newLevelId,
      targetedLevelId: levelId,
      name: 'Previous world',
      x1: 10,
      x2: 110,
      y1: 10,
      y2: 110,
    });
  }

  analytics.track(user._id, '🐣 Level Created', { level_id: newLevelId, level_name: levelName });
  log('createLevel: done', { levelId: newLevelId, levelName });

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

Meteor.publish('levels', function () {
  if (!this.userId) return undefined;

  return Levels.find({ }, { fields: { name: 1, hide: 1, visit: 1, createdBy: 1, template: 1 } });
});

Meteor.publish('levelTemplates', function () {
  if (!this.userId) return undefined;

  return Levels.find({ template: true, hide: { $exists: false } }, { fields: { name: 1, hide: 1, visit: 1, createdBy: 1, template: 1 } });
});

Meteor.publish('currentLevel', function () {
  if (!this.userId) return undefined;

  const { name } = Meteor.user().profile;
  const { levelId } = Meteor.user().profile || Meteor.settings.defaultLevelId;
  callHooks(Levels.findOne(levelId), activityType.userEnteredLevel, { userId: this.userId, meta: { name } });

  this.onStop(() => callHooks(Levels.findOne(levelId), activityType.userLeavedLevel, { userId: this.userId, meta: { name } }));

  return Levels.find(
    { _id: levelId },
    { fields: { name: 1, spawn: 1, hide: 1, height: 1, width: 1, editorUserIds: 1, createdBy: 1, sandbox: 1, guildId: 1 } },
  );
});

Meteor.methods({
  toggleLevelEditionPermission(userId) {
    check(userId, Match.Id);

    const user = Meteor.user();
    const { levelId } = user.profile;

    if (!canEditActiveLevel(user)) return;

    if (!canEditActiveLevel(Meteor.users.findOne(userId))) Levels.update(levelId, { $addToSet: { editorUserIds: { $each: [userId] } } });
    else Levels.update(levelId, { $pull: { editorUserIds: userId } });
  },
  createLevel(templateId = undefined) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(templateId, Match.Maybe(Match.Id));

    return createLevel({ templateId });
  },
  updateLevel(name, position, hide) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(name, String);
    check(position, { x: Number, y: Number });
    check(hide, Boolean);

    const user = Meteor.user();
    const level = currentLevel(Meteor.user());
    if (!level || level.sandbox) throw new Meteor.Error('invalid-level', 'A valid level is required');
    if (!canEditLevel(user, level)) throw new Meteor.Error('permission-error', `You can't edit this level`);

    const query = { $set: { name, spawn: { x: position.x, y: position.y } } };
    if (hide) query.$set.hide = true;
    else query.$unset = { hide: 1 };

    Levels.update(level._id, query);
  },
  increaseLevelVisits(levelId) {
    if (!this.userId) return;
    check(levelId, Match.Id);

    Levels.update({ _id: levelId, createdBy: { $ne: this.userId } }, { $inc: { visit: 1 } });
  },
});
