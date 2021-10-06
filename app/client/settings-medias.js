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

const setVideoPreviewElementStream = (stream, updatePeer = false) => {
  const video = document.querySelector('#js-video-preview');
  video.srcObject = stream;
  video.onloadedmetadata = () => video.play();
  if (updatePeer) peer.updatePeersStream(stream, streamTypes.main);
};

const initStream = () => {
  userStreams.requestUserMedia().then(settings.enumerateDevices).then(stream => setVideoPreviewElementStream(stream));
};

Template.settingsMedias.onRendered(() => {
  initStream();
  navigator.mediaDevices.ondevicechange = () => userStreams.requestUserMedia(true).then(settings.enumerateDevices);
});

Template.settingsMedias.onDestroyed(() => {
  if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
});

Template.settingsMedias.events({
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
    userStreams.createStream(true).then(stream => setVideoPreviewElementStream(stream, true));
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
    userStreams.createStream(true).then(stream => setVideoPreviewElementStream(stream, true));
  },
  'change .js-screen-framerate'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.screenShareFrameRate': +event.target.value } });
    if (userStreams.streams.screen.instance) {
      const constraints = userStreams.getStreamConstraints(streamTypes.screen);
      userStreams.applyConstraints(streamTypes.screen, 'video', constraints);
    }
  },
});

Template.settingsMedias.helpers({
  frameRate() {
    return Meteor.user().profile.screenShareFrameRate || 22;
  },
});
