const setVideoPreviewElementStream = stream => {
  const video = document.querySelector('#js-video-preview');
  video.srcObject = stream;
  video.onloadedmetadata = () => video.play();
  peer.updatePeersStream(stream, streamTypes.main);
};

const updateSettingsStream = template => {
  const constraints = userStreams.getStreamConstraints(streamTypes.main);
  constraints.forceNew = true;

  userStreams.requestUserMedia(constraints)
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
  this.deviceChangerListener = () => updateSettingsStream(this);
  updateSettingsStream(this);

  navigator.mediaDevices.addEventListener('devicechange', this.deviceChangerListener);
});

Template.settingsMedias.onDestroyed(function () {
  if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
  navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangerListener);
});

Template.settingsMedias.events({
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
    updateSettingsStream(Template.instance());
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
    updateSettingsStream(Template.instance());
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
  frameRate() { return Meteor.user().profile.screenShareFrameRate || 22; },
  audioRecorders() { return Template.instance().audioRecorders.get(); },
  videoRecorders() { return Template.instance().videoRecorders.get(); },
});
