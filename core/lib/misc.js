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

const permissionTypes = Object.freeze({
  talkToUsers: 'talkToUsers',
  useEntity: 'useEntity',
  changeSkin: 'changeSkin',
});

const defaultSpawnPosition = { x: 100, y: 100 };

/**
 * Returns a random integer in the range [min, max]
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Returns a random float, capped to the given decimals, in the range [min, max]
 *
 * @param {number} min
 * @param {number} max
 * @param {number} decimals
 * @returns {number}
 */
const randomFloatInRange = (min, max, decimals) =>
  parseFloat(
    (Math.random() * (max - min) + min)
      .toFixed(decimals)
  );

const subscribedUsersToEntity = entityId => {
  check(entityId, Match.Id);

  return Meteor.users.find(
    { entitySubscriptionIds: entityId },
    {
      fields: { 'status.online': 1, 'profile.body': 1, 'profile.eyes': 1, 'profile.accessory': 1, 'profile.hair': 1, 'profile.outfit': 1, 'profile.name': 1 },
      sort: { 'profile.name': 1 },
    },
  ).fetch();
};

const fileOnBeforeUpload = (file, mime) => {
  const { meta, size } = file;

  if (size > 5000000) return `File too big (> 5MB)`;

  if (['editor-tilesets', 'editor-characters', 'toolbox-entity'].includes(meta.source)) {
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

  return 'Source of upload not set';
};

const isLevelOwner = (user, level) => {
  check([user._id, level.createdBy], [Match.Id]);
  return level.createdBy === user._id;
};

const currentLevel = user => {
  check(user._id, Match.Id);
  return Levels.findOne(user.profile.levelId);
};

const canAccessZone = (zone, user) => {
  check([zone._id, user._id], [Match.Id]);

  if (user.roles?.admin) return true;

  // make sure that all the necessary items are in the user's inventory
  if (zone.requiredItems?.length) {
    const userItems = Object.keys(user.inventory || {});
    if (!zone.requiredItems.every(tag => userItems.includes(tag))) return false;
  }

  // verifies that the user is a member of the level guild
  if (zone.accessRestrictedToGuild) {
    const level = currentLevel(user);
    if (!level) throw new Meteor.Error('not-found', 'Level not found');
    if (!level.guildId) throw new Meteor.Error('configuration-missing', 'Guild not linked to the level. You must link a guild to the level or remove the "accessRestrictedToGuild" attribute');

    if (level.guildId !== user.guildId) return false;
  }

  return true;
};

const canEditGuild = (user, guild) => {
  check([user._id, guild._id], [Match.Id]);

  if (user.roles?.admin) return true;
  if (!user.guildId) return false;
  if (guild.createdBy === user._id) return true;

  return user.guildId === guild._id && guild.owners?.includes(user._id) === true;
};

const canEditLevel = (user, level) => {
  check([user._id, level._id], [Match.Id]);

  if (user.roles?.admin) return true;

  if (user._id === level.createdBy) return true;
  if (level.sandbox) return true;

  return !!level.editorUserIds?.includes(user._id);
};

const canEditActiveLevel = user => {
  check(user._id, Match.Id);
  return canEditLevel(user, Levels.findOne(user.profile.levelId));
};

const canEditUserPermissions = (user, level) => {
  check([user._id, level._id], [Match.Id]);
  return user.roles?.admin || isLevelOwner(user, level);
};

const canModerateLevel = (level, user) => {
  check([user._id, level._id], [Match.Id]);
  return user.roles?.admin || user.guildId === level.guildId;
};

const canModerateUser = (user, otherUser) => {
  check([user._id, otherUser._id], [Match.Id]);

  if (user._id === otherUser._id) return false;
  if (user.guildId && user.guildId === otherUser.guildId) return false;
  if (!user.roles?.admin && otherUser.roles?.admin) return false;
  if (user.roles?.admin && !otherUser.roles?.admin) return true;

  return !otherUser.guildId;
};

const generateRandomCharacterSkin = (userId, levelId = undefined) => {
  check(levelId, Match.Maybe(Match.Id));
  check(userId, Match.Id);
  const characterPartsKeys = Object.keys(charactersParts);

  const user = Meteor.users.findOne(userId);
  if (!user) throw new Meteor.Error('not-found', 'User not found');

  let newProfile = { ...user.profile };
  const level = currentLevel(user);
  if (!user.profile?.body && level?.skins?.default) {
    newProfile = {
      ...newProfile,
      ...level.skins.default,
    };
  } else {
    const characters = Characters.find({ category: { $exists: true }, $or: [{ hide: { $exists: false } }, { hide: false }] }, { fields: { _id: true, category: true } }).fetch();

    if (characters.length === 0) {
      newProfile = {
        ...newProfile,
        ...Meteor.settings.public.skins.default,
      };
    } else {
      log('generateRandomCharacterSkin: Randomize character parts...');
      characterPartsKeys.forEach(part => {
        const parts = characters.filter(character => character.category === part);
        if (parts.length) newProfile[part] = parts[_.random(0, parts.length - 1)]._id;
      });
    }
  }

  // Updates only the attributes related to the user skin elements
  const queryFields = {};
  characterPartsKeys.forEach(characterPartKey => { queryFields[`profile.${characterPartKey}`] = newProfile[characterPartKey]; });
  Meteor.users.update(user._id, { $set: { ...queryFields } });
};

const completeUserProfile = (user, email, name) => {
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

const levelSpawnPosition = level => {
  check(level._id, Match.Id);

  const zones = Zones.find({ levelId: level._id, spawn: true }).fetch();
  if (zones.length) {
    const zone = zones[randomInRange(0, zones.length - 1)];
    return { x: randomInRange(zone.x1, zone.x2), y: randomInRange(zone.y1, zone.y2) };
  }

  if (!level.spawn) return defaultSpawnPosition;

  const x = +level.spawn.x;
  const y = +level.spawn.y;

  return {
    x: Number.isNaN(x) ? defaultSpawnPosition.x : x,
    y: Number.isNaN(y) ? defaultSpawnPosition.y : y,
  };
};

const teleportUserInLevel = (user, level, source = 'teleporter') => {
  check([user._id, level._id], [Match.Id]);
  if (user.profile.levelId === level._id) return level.name;

  log('teleportUserInLevel: start', { levelId: level._id, userId: user._id, currentLevel: user.profile.levelId });

  const { x, y } = levelSpawnPosition(level);
  Meteor.users.update(user._id, { $set: { 'profile.levelId': level._id, 'profile.x': x, 'profile.y': y } });

  analytics.track(user._id, '🧳 Level Teleport', { user_id: user._id, level_id: level._id, source, level_name: level.name });

  log('teleportUserInLevel: done', { levelId: level._id, userId: user._id, x, y });

  return level.name;
};

const guestAllowed = permissionType => {
  const guestPermissions = Meteor.settings.public.permissions?.guest || {};
  return !!guestPermissions[permissionType];
};

const getChannelType = channelId => {
  switch (channelId?.split('_')[0]) {
    case 'qst':
      return 'quest';
    case 'zon':
      return 'zone';
    case 'lvl':
      return 'level';
    case 'usr':
      return 'discussion';
    default:
      return 'unknown';
  }
};

export {
  canAccessZone,
  canEditActiveLevel,
  canEditGuild,
  canEditLevel,
  canEditUserPermissions,
  canModerateLevel,
  canModerateUser,
  completeUserProfile,
  currentLevel,
  fileOnBeforeUpload,
  generateRandomCharacterSkin,
  guestAllowed,
  getChannelType,
  isLevelOwner,
  levelSpawnPosition,
  permissionTypes,
  subscribedUsersToEntity,
  teleportUserInLevel,
  randomInRange,
  randomFloatInRange,
};
