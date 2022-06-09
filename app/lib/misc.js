entityActionType = Object.freeze({
  none: 0,
  actionable: 1,
  pickable: 2,
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
  const user = Meteor.users.findOne(userId);
  if (!user) return false;
  if (user.roles?.admin) return true;
  if (!user.guildId) return false;

  const guild = Guilds.findOne(guildId);
  if (!guild) return false;

  return guild.createdBy === userId;
};

isEditionAllowed = userId => {
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

  return generateRandomCharacterSkin(Meteor.user(), user.profile.levelId);
};

generateRandomCharacterSkin = (user, levelId) => {
  let newProfile = { ...user.profile };
  const currentLevel = Levels.findOne(levelId);
  if (!user.profile?.body && currentLevel?.skins?.default) {
    newProfile = {
      ...newProfile,
      ...currentLevel.skins.default,
    };
  } else if (Characters.find({}).count() === 0) {
    newProfile = {
      ...newProfile,
      ...Meteor.settings.public.skins.default,
    };
  } else {
    ['body', 'outfit', 'eye', 'hair', 'accessory'].forEach(part => {
      log('generateRandomCharacterSkin: Randomize character parts...');
      const parts = Characters.find({ category: part, $or: [{ hide: { $exists: false } }, { hide: false }] }).fetch();
      if (parts.length) newProfile[part] = parts[_.random(0, parts.length - 1)]._id;
    });
  }

  Meteor.users.update(user._id, { $set: { profile: { ...newProfile } } });
};

teleportUserInLevel = (levelId, userId) => {
  check([levelId, userId], [String]);

  log('teleportUserInLevel: start', { levelId, userId });
  const loadingLevelId = levelId || Meteor.settings.defaultLevelId;
  const level = Levels.findOne(loadingLevelId);
  if (!level) throw new Meteor.Error('not-found', `Level not found`);

  const { x, y } = levelSpawnPosition(loadingLevelId);
  Meteor.users.update(userId, { $set: { 'profile.levelId': level._id, 'profile.x': x, 'profile.y': y } });

  return level.name;
};

subscribedUsersToEntity = entityId => Meteor.users.find(
  { entitySubscriptionIds: entityId },
  {
    fields: { 'status.online': 1, 'profile.body': 1, 'profile.eyes': 1, 'profile.accessory': 1, 'profile.hair': 1, 'profile.outfit': 1, 'profile.name': 1 },
    sort: { 'profile.name': 1 },
  },
).fetch();

userAllowedInZone = (user, zone) => {
  if (zone.adminOnly && !user.roles?.admin) return false;

  if (zone.requiredItems?.length) {
    if (user.profile.guest) return false;

    const userItems = Object.keys(user.inventory || {});
    return zone.requiredItems.every(tag => userItems.includes(tag));
  }

  return true;
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
