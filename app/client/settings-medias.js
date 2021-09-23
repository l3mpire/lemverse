Session.setDefault('audioRecorders', []);
Session.setDefault('videoRecorders', []);

settings = {
  enumerateDevices(stream) {
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

    return stream;
  },
};

const initStream = () => {
  peer.requestUserMedia(true).then(settings.enumerateDevices).then(stream => {
    const video = document.querySelector('#js-video-preview');
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();
  });
};

Template.settingsMedias.onRendered(() => {
  initStream();
  navigator.mediaDevices.ondevicechange = () => peer.requestUserMedia(true).then(settings.enumerateDevices);
});

Template.settingsMedias.onDestroyed(() => {
  if (userProximitySensor.nearUsersCount() === 0) peer.destroyStream(myStream);
});

Template.settingsMedias.events({
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
    initStream();
    if (!myStream) return;
    peer.applyConstraints(myStream, 'audio', { deviceId: event.target.value });
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
    initStream();
    if (!myStream) return;
    peer.applyConstraints(myStream, 'video', { deviceId: event.target.value });
  },
  'change .js-screen-framerate'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.screenShareFrameRate': event.target.value } });
    if (myScreenStream) peer.applyConstraints(myScreenStream, 'video', { frameRate: event.target.value });
  },
});

Template.settingsMedias.helpers({
  frameRate() {
    return Meteor.user().profile.screenShareFrameRate || 22;
  },
});
