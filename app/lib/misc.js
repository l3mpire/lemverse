const crypto = require('crypto');

entityActionType = Object.freeze({
  none: 0,
  actionable: 1,
  pickable: 2,
});

destroyVideoSource = video => {
  if (!video) return;
  video.pause();
  video.src = '';
  video.load();
};

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

communicationAllowed = userId => {
  const level = userLevel(userId);
  if (!level) return false;

  // todo: check if the user is in the zone

  return true;
};

isLevelOwner = userId => {
  const level = userLevel(userId);
  if (!level) return false;

  return level.createdBy === userId;
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

messageModerationAllowed = (userId, message) => {
  if (!userId || !message) return false;
  if (message.createdBy === userId) return true;

  return isEditionAllowed(userId);
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

generateTURNCredentials = (name, secret) => {
  const unixTimeStamp = parseInt(Date.now() / 1000, 10) + Meteor.settings.peer.client.credentialDuration;
  const username = [unixTimeStamp, name].join(':');
  const hmac = crypto.createHmac('sha1', secret);
  hmac.setEncoding('base64');
  hmac.write(username);
  hmac.end();

  return {
    username,
    password: hmac.read(),
  };
};

waitFor = (condition, attempt, delay = 250) => new Promise((resolve, reject) => {
  let currentAttempt = 0;
  const waitFunc = () => {
    currentAttempt++;
    if (condition()) { resolve(); return; }
    if (currentAttempt >= attempt) reject(new Error('too many attempt'));
    else setTimeout(waitFunc, delay);
  };

  waitFunc();
});

generateRandomAvatarURLForUser = user => Meteor.settings.public.peer.avatarAPI
  .replace('[user_id]', encodeURI(user._id || 'guest'))
  .replace('[user_name]', encodeURI(user.profile.name || 'guest'))
  .replace('[user_avatar]', encodeURI(user.profile.avatar || 'cat'));

stringToColor = str => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);

  let colour = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    colour += (`00${value.toString(16)}`).substr(-2);
  }
  return colour;
};

teleportUserInLevel = (levelId, userId) => {
  check([levelId, userId], [String]);

  const level = Levels.findOne(levelId) || Levels.findOne(Meteor.settings.defaultLevelId);
  const { spawn } = level;
  Meteor.users.update(userId, { $set: { 'profile.levelId': level._id, 'profile.x': spawn?.x || 0, 'profile.y': spawn?.y || 0 } });

  return level.name;
};

sendEvent = (command, data = {}) => {
  window.parent.postMessage(JSON.parse(JSON.stringify({ command, ...data })), '*');
};

subscribedUsersToEntity = entityId => Meteor.users.find(
  { entitySubscriptionIds: entityId },
  { fields: { 'profile.body': 1, 'profile.hair': 1, 'profile.outfit': 1, 'profile.name': 1 } },
).fetch();
