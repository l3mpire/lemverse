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

Template.settingsMedias.onRendered(() => {
  const video = document.querySelector('#js-video-preview');
  peer.requestUserMedia().then(settings.enumerateDevices).then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();
  });
  navigator.mediaDevices.ondevicechange = () => peer.requestUserMedia().then(settings.enumerateDevices);
});

Template.settingsMedias.onDestroyed(() => {
  if (userProximitySensor.nearUsersCount() === 0) peer.destroyStream();
});

Template.settingsMedias.events({
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
    if (!myStream) return;
    peer.applyConstraints(myStream, 'audio', { deviceId: event.target.value });
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
    if (!myStream) return;
    peer.applyConstraints(myStream, 'video', { deviceId: event.target.value });
  },
});
