const setVideoPreviewElementStream = (stream, updatePeer = false) => {
  const video = document.querySelector('#js-video-preview');
  video.srcObject = stream;
  video.onloadedmetadata = () => video.play();
  if (updatePeer) peer.updatePeersStream(stream, streamTypes.main);
};

const initStream = template => {
  userStreams.requestUserMedia(true)
    .then(stream => {
      userStreams.enumerateDevices().then(({ mics, cams }) => {
        template.audioRecorders.set(mics);
        template.videoRecorders.set(cams);
      });

      return stream;
    }).then(stream => setVideoPreviewElementStream(stream));
};

Template.settingsMedias.onCreated(function () {
  this.audioRecorders = new ReactiveVar([]);
  this.videoRecorders = new ReactiveVar([]);
  initStream(this);
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
  audioRecorders() {
    return Template.instance().audioRecorders.get();
  },
  videoRecorders() {
    return Template.instance().videoRecorders.get();
  },
});
