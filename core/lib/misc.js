entityActionType = Object.freeze({
  none: 0,
  actionable: 1,
  pickable: 2,
});

charactersParts = Object.freeze({
  body: 0,
  outfit: 1,
  eye: 2,
  hair: 3,
  accessory: 4,
});

const defaultSpawnPosition = { x: 100, y: 100 };

nearestDuration = duration => {
  const message = [];
  message.push(lp.s.lpad(moment.duration(duration).asHours() | 0, 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).minutes(), 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).seconds(), 2, '0'));

  return message.join(':');
};

userLevel = userId => {
  const user = Meteor.users.findOne(userId);
  if (!user) return undefined;

  return Levels.findOne(user.profile.levelId);
};

levelSpawnPosition = levelId => {
  const level = Levels.findOne(levelId);
  if (!level?.spawn) return defaultSpawnPosition;

  const x = +level.spawn.x;
  const y = +level.spawn.y;

  return { x: Number.isNaN(x) ? defaultSpawnPosition.x : x, y: Number.isNaN(y) ? defaultSpawnPosition.y : y };
};

isLevelOwner = userId => {
  const level = userLevel(userId);
  if (!level) return false;

  return level.createdBy === userId;
};

canEditGuild = (userId, guildId) => {
  check([userId, guildId], [Match.Id]);

  const user = Meteor.users.findOne(userId);
  if (!user) return false;

  const guild = Guilds.findOne(guildId);
  if (!guild) return false;

  if (user.roles?.admin) return true;
  if (!user.guildId) return false;

  return user.guildId === guildId && guild.owners?.includes(userId);
};

canAccessZone = (zoneId, userId) => {
  check([zoneId, userId], [Match.Id]);

  const zone = Zones.findOne(zoneId);
  if (!zone) throw new Meteor.Error('not-found', 'Zone not found');

  const user = Meteor.users.findOne(userId);
  if (!user) throw new Meteor.Error('not-found', 'User not found');
  if (user.roles?.admin) return true;

  // make sure that all the necessary items are in the user's inventory
  if (zone.requiredItems?.length) {
    const userItems = Object.keys(user.inventory || {});
    if (!zone.requiredItems.every(tag => userItems.includes(tag))) return false;
  }

  // verifies that the user is a member of the level guild
  if (zone.restrictedToGuild) {
    const level = userLevel(userId);
    if (!level) throw new Meteor.Error('not-found', 'Level not found');
    if (!level.guildId) throw new Meteor.Error('configuration-missing', 'Guild not linked to the level. You must link a guild to the level or remove the "restrictedToGuild" attribute');

    if (level.guildId !== user.guildId) return false;
  }

  return true;
};

isEditionAllowed = userId => {
  check(userId, Match.Id);

  const user = Meteor.users.findOne(userId);
  if (!user) return false;

  if (user.roles?.admin) return true;

  const { levelId } = user.profile;
  const level = Levels.findOne(levelId);
  if (!level) return false;

  if (userId === level.createdBy) return true;
  if (level.sandbox) return true;
  if (level.editorUserIds?.includes(userId)) return true;

  return false;
};

completeUserProfile = (user, email, name) => {
  try {
    Promise.await(Meteor.users.update(user._id, {
      $set: {
        emails: [{
          address: email,
          verified: false,
        }],
        profile: {
          ...user.profile,
          name,
          shareAudio: true,
          shareVideo: true,
        },
      },
    }));
  } catch (err) { throw new Meteor.Error('email-duplicate', 'Email already exists'); }

  Meteor.users.update(user._id, { $unset: { 'profile.guest': true, username: true } });

  return generateRandomCharacterSkin(Meteor.userId(), user.profile.levelId);
};

generateRandomCharacterSkin = (userId, levelId = undefined) => {
  check(levelId, Match.Maybe(Match.Id));
  check(userId, Match.Id);
  const characterPartsKeys = Object.keys(charactersParts);

  const user = Meteor.users.findOne(userId);
  if (!user) throw new Meteor.Error('not-found', 'User not found');

  let newProfile = { ...user.profile };
  const currentLevel = Levels.findOne(levelId);
  if (!user.profile?.body && currentLevel?.skins?.default) {
    newProfile = {
      ...newProfile,
      ...currentLevel.skins.default,
    };
  } else if (Characters.find().count() === 0) {
    newProfile = {
      ...newProfile,
      ...Meteor.settings.public.skins.default,
    };
  } else {
    characterPartsKeys.forEach(part => {
      log('generateRandomCharacterSkin: Randomize character parts...');
      const parts = Characters.find({ category: part, $or: [{ hide: { $exists: false } }, { hide: false }] }).fetch();
      if (parts.length) newProfile[part] = parts[_.random(0, parts.length - 1)]._id;
    });
  }

  // Updates only the attributes related to the user skin elements
  const queryFields = {};
  characterPartsKeys.forEach(characterPartKey => { queryFields[`profile.${characterPartKey}`] = newProfile[characterPartKey]; });
  Meteor.users.update(user._id, { $set: { ...queryFields } });
};

teleportUserInLevel = (levelId, userId) => {
  check([levelId, userId], [Match.Id]);

  log('teleportUserInLevel: start', { levelId, userId });
  const loadingLevelId = levelId;
  const level = Levels.findOne(loadingLevelId);
  if (!level) throw new Meteor.Error('missing-level', `Level not found`);

  const user = Meteor.users.findOne(userId);
  if (!user) throw new Meteor.Error('missing-user', `User not found`);
  if (user.profile.levelId === levelId) throw new Meteor.Error('already-here', `User already in the level`);

  const { x, y } = levelSpawnPosition(loadingLevelId);
  Meteor.users.update(userId, { $set: { 'profile.levelId': level._id, 'profile.x': x, 'profile.y': y } });

  analytics.track(userId, '🧳 Level Teleport', { user_id: userId, level_id: levelId });

  return level.name;
};

subscribedUsersToEntity = entityId => {
  check(entityId, Match.Id);

  return Meteor.users.find(
    { entitySubscriptionIds: entityId },
    {
      fields: { 'status.online': 1, 'profile.body': 1, 'profile.eyes': 1, 'profile.accessory': 1, 'profile.hair': 1, 'profile.outfit': 1, 'profile.name': 1 },
      sort: { 'profile.name': 1 },
    },
  ).fetch();
};

fileOnBeforeUpload = (file, mime) => {
  const { meta, size } = file;

  if (size > 5000000) return `File too big (> 5MB)`;

  if (meta.source === 'editor-tilesets') {
    if (!['image/png', 'image/jpeg'].includes(mime)) return `Only jpeg and png can be uploaded`;
    return true;
  }

  if (meta.source === 'editor-characters') {
    if (!['image/png', 'image/jpeg'].includes(mime)) return `Only jpeg and png can be uploaded`;
    return true;
  }

  if (meta.source === 'voice-recorder') {
    if (!['audio/webm', 'audio/ogg', 'audio/mp4'].includes(mime)) return `Only webm, ogg and mp4 can be uploaded`;
    if (!meta.userIds.length) return `userIds are required to send an audio file`;

    return true;
  }

  if (meta.source === 'editor-assets') {
    if (!['image/png', 'image/jpeg', 'application/json'].includes(mime)) return `Only jpeg, png and json files can be uploaded`;
    return true;
  }

  if (meta.source === 'user-console') {
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(mime)) return `Only jpeg, png and gif files can be uploaded`;
    return true;
  }

  if (meta.source === 'toolbox-entity') {
    if (!['image/png', 'image/jpeg'].includes(mime)) return `Only jpeg and png files can be uploaded`;
    return true;
  }

  return 'Source of upload not set';
};
