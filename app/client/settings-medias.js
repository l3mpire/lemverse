Session.setDefault('audioRecorders', []);
Session.setDefault('videoRecorders', []);

const setVideoPreviewElementStream = (stream, updatePeer = false) => {
  const video = document.querySelector('#js-video-preview');
  video.srcObject = stream;
  video.onloadedmetadata = () => video.play();
  if (updatePeer) peer.updatePeersStream(stream, streamTypes.main);
};

const initStream = (forceNewStream = false) => {
  userStreams.requestUserMedia(forceNewStream)
    .then(stream => {
      userStreams.enumerateDevices().then(({ mics, cams }) => {
        Session.setDefault('audioRecorders', mics);
        Session.setDefault('videoRecorders', cams);
      });

      return stream;
    }).then(stream => setVideoPreviewElementStream(stream));
};

Template.settingsMedias.onRendered(() => {
  initStream();
  navigator.mediaDevices.ondevicechange = () => userStreams.createStream(true).then(stream => setVideoPreviewElementStream(stream, true));
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
