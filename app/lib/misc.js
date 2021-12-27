const crypto = require('crypto');

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

isEditionAllowed = userId => {
  if (!userId) return false;
  const user = Meteor.users.findOne(userId);
  if (!user) return false;
  const { levelId } = user.profile;
  const currentLevel = Levels.findOne(levelId);
  if (user?.roles?.admin && !currentLevel?.disableEdit) return true;

  return (currentLevel?.sandbox || currentLevel?.editorUserIds?.includes(user._id) || user._id === currentLevel.createdBy) && (!currentLevel?.disableEdit);
};

updateSkin = (user, levelId) => {
  if (!user) throw new Error('missing user parameter');
  if (!levelId) throw new Error('missing levelId parameter');

  let newProfile = { ...user.profile };
  const currentLevel = Levels.findOne({ _id: levelId });
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
      log('updateSkin: Randomize character parts...');
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

getRandomAvatarForUser = user => {
  let URL = Meteor.settings.public.peer.avatarAPI;
  URL = URL.replace('[user_id]', encodeURI(user._id));
  URL = URL.replace('[user_name]', encodeURI(user.profile.name));
  URL = URL.replace('[user_avatar]', encodeURI(user.profile.avatar || 'cat'));

  return URL;
};

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
