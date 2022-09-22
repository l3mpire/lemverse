import Phaser from 'phaser';

viewportModes = Object.freeze({
  fullscreen: 'fullscreen',
  small: 'small',
  splitScreen: 'split-screen',
});

editorModes = Object.freeze({
  entities: 'entities',
  tiles: 'tiles',
  zones: 'zones',
  level: 'level',
});

eventTypes = Object.freeze({
  onEntityAdded: 'onEntityAdded',
  onEntityUpdated: 'onEntityUpdated',
  onEntityRemoved: 'onEntityRemoved',
  onMenuOptionSelected: 'onMenuOptionSelected',
  onMenuOptionUnselected: 'onMenuOptionUnselected',
  onNotificationClicked: 'onNotificationClicked',
  onNotificationReceived: 'onNotificationReceived',
  onPeerDataReceived: 'onPeerDataReceived',
  onMediaStreamStateChanged: 'onMediaStreamStateChanged',
  onTileAdded: 'onTileAdded',
  onTileChanged: 'onTileChanged',
  onUsersComeCloser: 'onUsersComeCloser',
  onUsersMovedAway: 'onUsersMovedAway',
  onZoneEntered: 'onZoneEntered',
  onZoneLeft: 'onZoneLeft',
  onZoneAdded: 'onZoneAdded',
  onZoneUpdated: 'onZoneUpdated',
  onZoneRemoved: 'onZoneRemoved',
  onPopInEvent: 'pop-in-event',
  onWorldSceneCreated: 'onWorldSceneCreated',
  beforeSendingMessage: 'beforeSendingMessage',
  afterSendingMessage: 'afterSendingMessage',
  consoleClosed: 'consoleClosed',
});

// reset previously loaded modules
Session.set('modules', []);
Session.set('teamModules', []);
Session.set('userListModules', []);
Session.set('radialMenuModules', []);

toggleUserProperty = (propertyName, value) => {
  const user = Meteor.user();
  if (!user) return;

  const toggleMicOn = value || (value === undefined && !user.profile.shareAudio);
  const toggleCamOn = value || (value === undefined && !user.profile.shareVideo);

  if (toggleMicOn || toggleCamOn) {
    const zone = zoneManager.currentZone();

    // disable medias switch in meeting
    if (zone && meet.api) {
      if (propertyName === 'shareAudio' && !zone.unmute) {
        lp.notif.warning(`Your microphone is only accessible on stage `);
        return;
      }

      if (propertyName === 'shareVideo' && !zone.unhide) {
        lp.notif.warning(`Your camera is only accessible on stage `);
        return;
      }
    }

    // disable medias switch in focus zones
    if (zone?.disableCommunications) {
      lp.notif.warning(`You can't activate your camera and microphone in a focus zone`);
      return;
    }
  }

  if (typeof value === 'boolean') Meteor.users.update(user._id, { $set: { [`profile.${propertyName}`]: !!value } });
  else Meteor.users.update(user._id, { $set: { [`profile.${propertyName}`]: !user.profile[propertyName] } });
};

relativePositionToCamera = (position, camera) => {
  const { worldView, zoom } = camera;
  return { x: (position.x - worldView.x) * zoom, y: (position.y - worldView.y) * zoom };
};

updateViewport = (scene, mode) => {
  if (typeof mode !== 'string') mode = scene.viewportMode;

  if (meet.lowLevel) return;

  const lemverseTag = document.querySelector('.lemverse');
  lemverseTag.classList.toggle('screen-splitted', mode === viewportModes.splitScreen);

  if (mode === viewportModes.small) scene.cameras.main.setViewport(0, 0, window.innerWidth / 3, window.innerHeight);
  else if (mode === viewportModes.splitScreen) scene.cameras.main.setViewport(0, 0, window.innerWidth / 2, window.innerHeight);
  else scene.cameras.main.setViewport(0, 0, window.innerWidth, window.innerHeight);

  scene.viewportMode = mode;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatURL = url => {
  let formattedURL;
  try {
    formattedURL = new URL(url);
  } catch (err) {
    return undefined;
  }

  return formattedURL;
};

const formatURLs = (text, shortName = false) => text.replace(/(https?:\/\/[^\s]+)/g, url => {
  const formatedURL = formatURL(url);
  if (!formatedURL) return url;

  let linkName = url;
  if (shortName) {
    const name = formatedURL.hostname.replace('www.', '');
    const lastDot = name.lastIndexOf('.') || name.length;
    linkName = lastDot === -1 ? name : name.substring(lastDot, 0);
  }

  return `<a href="${formatedURL}" target="_blank" title="${formatedURL}">${linkName}</a>`;
});

sendDataToUsers = (type, data, emitterId, userIds = []) => {
  let targets = [...new Set(userIds)];
  targets = targets.filter(target => target !== Meteor.userId());
  if (!targets.length) throw new Error('no-targets');

  return peer.sendData(targets, { type, emitter: emitterId, data });
};

sendDataToUsersInZone = (type, data, emitterId) => {
  const user = Meteor.user();
  const usersInZone = zoneManager.usersInZone(zoneManager.currentZone(user));
  const userInZoneIds = usersInZone.map(u => u._id);
  if (!userInZoneIds.length) throw new Error('no-targets');

  return peer.sendData(userInZoneIds, { type, emitter: emitterId, data });
};

kebabCase = string => string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').toLowerCase();

nearUserIdsToString = (includeUser = true) => {
  const nearUsers = Object.keys(userProximitySensor.nearUsers);
  if (nearUsers.length && includeUser) nearUsers.push(Meteor.userId());

  return nearUsers.sort().join(';');
};

createFakeShadow = (scene, x, y, scaleX, scaleY) => {
  const shadow = scene.add.sprite(x, y, 'circle');
  shadow.alpha = 0.1;
  shadow.scaleX = scaleX;
  shadow.scaleY = scaleY;
  shadow.setDepth(-1);
  shadow.setTint(0x000000);

  return shadow;
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

const replaceTextVars = text => text.replaceAll(/{{\s?[\w\s]*\s?}}/g, element => {
  const value = element.replace('{{', '').replace('}}', '');
  const [type] = value.split('_');

  if (type === 'usr') return Meteor.users.findOne(value)?.profile.name || `User ${value}`;

  return element;
});

generateRandomAvatarURLForUser = user => Meteor.settings.public.peer.avatarAPI
  .replace('[user_id]', encodeURI(user._id || 'guest'))
  .replace('[user_name]', encodeURI(user.profile.name || 'guest'))
  .replace('[user_avatar]', encodeURI(user.profile.avatar || 'cat'));

sendEvent = (command, data = {}) => {
  window.parent.postMessage(JSON.parse(JSON.stringify({ command, ...data })), Meteor.settings.public.lp.website);
};

destroyVideoSource = video => {
  if (!video) return;
  video.pause();
  video.src = '';
  video.load();
};

const addToSession = (key, values) => {
  const existingModules = Session.get(key) || [];
  Session.set(key, [...new Set([...existingModules, ...values])]);
};

registerModules = modules => addToSession('modules', modules);
registerTeamModules = modules => addToSession('teamModules', modules);
registerUserListModules = modules => addToSession('userListModules', modules);
registerRadialMenuModules = modules => {
  const loadedModules = Session.get('radialMenuModules') || [];

  modules.forEach(module => {
    if (loadedModules.find(loadedModule => loadedModule.id === module.id)) return;
    loadedModules.push(module);
  });

  Session.set('radialMenuModules', loadedModules);
};

const allowPhaserMouseInputs = () => !Session.get('editor') && !Session.get('console');

// To avoid bugs related to network latency we accept a distance greater than that which launches a call to limit false negatives behaviors
const canAnswerCall = user => {
  if (userProximitySensor.isUserNear(user)) return true;

  const callDistanceThreshold = Meteor.settings.public.character.callDistanceThreshold || 300;
  return userProximitySensor.distance(Meteor.user(), user) <= callDistanceThreshold;
};

const toggleUIInputs = value => {
  hotkeys.setScope(value ? scopes.form : scopes.player);
  game?.scene.keys.WorldScene?.enableKeyboard(!value, false);
};

const generateEntityThumbnail = (entity, thumbnailMaxSize = 35) => {
  if (entity.thumbnail) {
    const filesRoute = Meteor.settings.public.files.route;
    const [x, y, w, h] = entity.thumbnail.rect;
    const url = `${filesRoute}/${entity.thumbnail.fileId}`;

    const maxSize = Math.max(w, h);
    const ratio = thumbnailMaxSize / maxSize;

    return `background-image: url("./${url}"); background-position: -${x}px -${y}px; width: ${w}px; height: ${h}px; transform: scale(${ratio});`;
  }

  const spriteURL = entity.gameObject?.sprite?.path;
  if (spriteURL) return `background-image: url("${spriteURL}"); background-size: contain; width: 100%; height: 100%;`;

  return `background-image: url("lemverse.png"); background-size: contain; width: 100%; height: 100%;`;
};

const guestSkin = () => {
  if (_.isObject(Meteor.settings.public.skins.guest)) return Meteor.settings.public.skins.guest;

  return Levels.findOne().skins?.guest || {};
};

const meteorCallWithPromise = (method, ...args) => new Promise((resolve, reject) => {
  Meteor.call(method, ...args, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
});

const nearestDuration = duration => {
  const message = [];
  message.push(lp.s.lpad(moment.duration(duration).asHours() | 0, 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).minutes(), 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).seconds(), 2, '0'));

  return message.join(':');
};

const setReaction = reaction => {
  if (reaction) {
    Meteor.call('analyticsReaction', { reaction });
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.reaction': reaction } });
  } else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.reaction': 1 } });
};

const textDirectionToVector = direction => {
  if (direction === 'left') return Phaser.Math.Vector2.LEFT;
  if (direction === 'right') return Phaser.Math.Vector2.RIGHT;
  if (direction === 'up') return Phaser.Math.Vector2.UP;
  if (direction === 'down') return Phaser.Math.Vector2.DOWN;

  return Phaser.Math.Vector2.ZERO;
};

const vectorToTextDirection = vector => {
  if (Math.abs(vector.x) > Math.abs(vector.y)) {
    if (vector.x <= -1) return 'left';
    else if (vector.x >= 1) return 'right';
  }

  if (vector.y <= -1) return 'up';
  else if (vector.y >= 1) return 'down';

  return undefined;
};

export {
  allowPhaserMouseInputs,
  canAnswerCall,
  clamp,
  guestSkin,
  formatURLs,
  formatURL,
  generateEntityThumbnail,
  meteorCallWithPromise,
  nearestDuration,
  replaceTextVars,
  setReaction,
  toggleUIInputs,
  textDirectionToVector,
  vectorToTextDirection,
};
