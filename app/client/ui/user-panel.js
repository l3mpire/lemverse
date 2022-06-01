const talking = () => !!peer.remoteStreamsByUsers.get().length;

const onMediaStreamStateChanged = event => {
  const { stream, type } = event.detail;

  if (type === streamTypes.screen) {
    if (!this.videoScreenShareElement) this.videoScreenShareElement = document.querySelector('.js-stream-screen-me video');
    if (!stream) destroyVideoSource(this.videoScreenShareElement);
    else this.videoScreenShareElement.srcObject = stream;

    const user = Meteor.user();
    if (user) this.videoScreenShareElement.classList.toggle('active', user.profile.shareScreen);
  } else if (type === streamTypes.main) {
    if (!this.videoElement) this.videoElement = document.querySelector('.js-stream-me video');
    if (!stream) destroyVideoSource(this.videoElement);
    else this.videoElement.srcObject = stream;
  }
};

Template.userPanel.onCreated(function () {
  this.avatarURL = new ReactiveVar();
  window.addEventListener(eventTypes.onMediaStreamStateChanged, onMediaStreamStateChanged);

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.avatar': 1 } });
    if (user) this.avatarURL.set(generateRandomAvatarURLForUser(user));
  });
});

Template.userPanel.onDestroyed(() => {
  window.removeEventListener(eventTypes.onMediaStreamStateChanged, onMediaStreamStateChanged);
});

Template.userPanel.helpers({
  active() { return talking(); },
  avatarURL() { return talking() && Template.instance().avatarURL.get(); },
  screenSharing() { return Meteor.user({ fields: { 'profile.shareScreen': 1 } })?.profile.shareScreen; },
  videoActive() { return talking() && Meteor.user({ fields: { 'profile.shareVideo': 1 } })?.profile.shareVideo; },
});
