const talking = () => !!peer.remoteStreamsByUsers.get().length;

Template.userPanel.onCreated(function () {
  this.avatarURL = new ReactiveVar();

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.avatar': 1 } });
    if (user) this.avatarURL.set(generateRandomAvatarURLForUser(user));
  });

  this.autorun(() => {
    if (!talking()) return;

    const user = Meteor.user({ fields: { 'profile.shareVideo': 1, 'profile.videoRecorder': 1 } });

    if (!this.videoElement) this.videoElement = document.querySelector('.js-stream-me video');

    if (!user.profile.shareVideo || isModalOpen('settingsMedia')) destroyVideoSource(this.videoElement);
    else this.videoElement.srcObject = userStreams.streams.main.instance;
  });
});

Template.userPanel.helpers({
  active() { return talking(); },
  avatarURL() { return talking() && Template.instance().avatarURL.get(); },
  videoActive() { return talking() && Meteor.user()?.profile.shareVideo; },
});
