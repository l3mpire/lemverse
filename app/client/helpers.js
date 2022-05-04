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
  onEntityUpdated: 'onEntityUpdated',
  onMenuOptionSelected: 'onMenuOptionSelected',
  onMenuOptionUnselected: 'onMenuOptionUnselected',
  onNotificationClicked: 'onNotificationClicked',
  onNotificationReceived: 'onNotificationReceived',
  onTileAdded: 'onTileAdded',
  onTileChanged: 'onTileChanged',
  onUserNear: 'onUserNear',
  onUserMovedAway: 'onUserMovedAway',
  onZoneEntered: 'onZoneEntered',
  onZoneLeft: 'onZoneLeft',
  onZoneAdded: 'onZoneAdded',
  onZoneUpdated: 'onZoneUpdated',
  onZoneRemoved: 'onZoneRemoved',
  onPopInEvent: 'pop-in-event',
  beforeSendingMessage: 'beforeSendingMessage',
  afterSendingMessage: 'afterSendingMessage',
  consoleClosed: 'consoleClosed',
});

toggleUserProperty = (propertyName, value) => {
  const user = Meteor.user();

  // the user must not be able to deactivate his microphone in the unmute zones
  if (propertyName === 'shareAudio' && (value || (value === undefined && !user.profile.shareAudio))) {
    if (meet.api && !zones.currentZone()?.unmute) {
      lp.notif.warning(`Your microphone is only accessible on stage`);
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

  if (mode === viewportModes.small) scene.cameras.main.setViewport(0, 0, window.innerWidth / 3, window.innerHeight);
  else if (mode === viewportModes.splitScreen) scene.cameras.main.setViewport(0, 0, window.innerWidth / 2, window.innerHeight);
  else scene.cameras.main.setViewport(0, 0, window.innerWidth, window.innerHeight);

  scene.viewportMode = mode;
};

formatURL = url => {
  let formattedURL;
  try {
    formattedURL = new URL(url);
  } catch (err) {
    return undefined;
  }

  return formattedURL;
};

formatURLs = (text, shortName = false) => text.replace(/(https?:\/\/[^\s]+)/g, url => {
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
  const usersInZone = zones.usersInZone(zones.currentZone(user));
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

meteorCall = (method, ...args) => new Promise((resolve, reject) => {
  Meteor.call(method, ...args, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
});

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
registerUserListModules = modules => addToSession('userListModules', modules);
registerRadialMenuModules = modules => addToSession('radialMenuModules', modules);
