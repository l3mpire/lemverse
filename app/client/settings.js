Session.setDefault('audioRecorders', []);
Session.setDefault('videoRecorders', []);

settings = {
  enumerateDevices() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = [];
      const cams = [];
      devices.forEach(device => {
        if (device.kind === 'audioinput') mics.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
        if (device.kind === 'videoinput') cams.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
      });
      Session.set('audioRecorders', mics);
      Session.set('videoRecorders', cams);
    });
  },
};

Template.settings.onRendered(() => {
  peer.requestUserMedia().then(settings.enumerateDevices);
  navigator.mediaDevices.ondevicechange = () => peer.requestUserMedia().then(settings.enumerateDevices);
});

Template.settings.onDestroyed(() => {
  if (userProximitySensor.nearUsersCount() === 0) peer.destroyStream();
});

Template.settings.events({
  'click .js-character-designer'() {
    Session.set('settingsMode', Session.get('settingsMode') === 'character' ? null : 'character');
  },
  'click .js-close-button'() {
    Session.set('displaySettings', false);
  },
  'input .js-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    const name = event.target.value;
    if (!name) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.name': name } });
    game.scene.keys.WorldScene.playerRename(name);
    return false;
  },
  'input .js-reaction'(event) {
    event.preventDefault();
    event.stopPropagation();

    const reaction = event.target.value;
    if (!reaction) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.defaultReaction': reaction } });
    return false;
  },
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
  },
});
