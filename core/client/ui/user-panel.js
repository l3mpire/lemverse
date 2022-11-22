import { guestAllowed, permissionTypes } from '../../lib/misc';

const talking = () => !!peer.remoteStreamsByUsers.get().length;

const onMediaStreamStateChanged = event => {
  const { stream, type } = event.detail;

  if (type === streamTypes.screen) {
    if (!this.videoScreenShareElement) this.videoScreenShareElement = document.querySelector('.js-stream-screen-me video');
    if (!stream) destroyVideoSource(this.videoScreenShareElement);
    else this.videoScreenShareElement.srcObject = stream;

    const user = Meteor.user({ fields: { 'profile.shareScreen': 1 } });
    if (user) this.videoScreenShareElement.classList.toggle('active', user.profile.shareScreen);
  } else if (type === streamTypes.main) {
    if (!this.videoElement) this.videoElement = document.querySelector('.js-stream-me video');
    if (!stream) destroyVideoSource(this.videoElement);
    else this.videoElement.srcObject = stream;
  }
};

Template.userPanel.onCreated(function () {
  if (Meteor.settings.public.features?.userPanel?.enabled === false) return;
  this.avatarURL = new ReactiveVar();
  window.addEventListener(eventTypes.onMediaStreamStateChanged, onMediaStreamStateChanged);

  hotkeys('space', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));
  hotkeys('shift+1', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));
  hotkeys('shift+2', { scope: scopes.player }, () => toggleUserProperty('shareVideo'));
  hotkeys('shift+3', { scope: scopes.player }, () => toggleUserProperty('shareScreen'));
  hotkeys('shift+4', { scope: scopes.player }, () => toggleModal('settingsMain'));

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.avatar': 1 } });
    if (user) this.avatarURL.set(generateRandomAvatarURLForUser(user));
  });
});

Template.userPanel.onDestroyed(() => {
  window.removeEventListener(eventTypes.onMediaStreamStateChanged, onMediaStreamStateChanged);
  hotkeys.unbind('space', scopes.player);
  hotkeys.unbind('shift+1', scopes.player);
  hotkeys.unbind('shift+2', scopes.player);
  hotkeys.unbind('shift+3', scopes.player);
  hotkeys.unbind('shift+4', scopes.player);
});

Template.userPanel.helpers({
  active() { return talking(); },
  avatarURL() { return talking() && Template.instance().avatarURL.get(); },
  screenSharing() { return Meteor.user({ fields: { 'profile.shareScreen': 1 } })?.profile.shareScreen; },
  videoActive() { return talking() && Meteor.user({ fields: { 'profile.shareVideo': 1 } })?.profile.shareVideo; },
  displayUserPanel() { return Meteor.settings.public.features?.userPanel?.enabled !== false; },
  canTalkToUser() { return Meteor.user({ fields: { 'profile.guest': 1 } })?.profile.guest && guestAllowed(permissionTypes.talkToUsers); },
  canUseMessaging() { return Meteor.user({ fields: { 'profile.guest': 1 } })?.profile.guest && guestAllowed(permissionTypes.useMessaging); },
});

Template.userPanel.events({
  'click .button.audio'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleUserProperty('shareAudio');
  },
  'click .button.video'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleUserProperty('shareVideo');
  },
  'click .button.screen'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleUserProperty('shareScreen');
  },
  'click .button.settings'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleModal('settingsMain');
  },
  'click .button.js-show-messaging-interface'(event) {
    event.preventDefault();
    event.stopPropagation();
    openConsole(true);
  },
  'click .button.js-show-users'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleModal('userList');
  },
  'click .js-openpanel'(event) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelector('.user-panel').focus();
  },
  'click .js-stream-me'(event) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelector('.user-panel').focus();
  },
  'focus .user-panel'(event) {
    event.currentTarget.classList.toggle('visible', true);
    document.querySelector('.js-openpanel').classList.toggle('displaynone', true);
  },
  'blur .user-panel'(event) {
    event.currentTarget.classList.toggle('visible', false);
    document.querySelector('.js-openpanel').classList.toggle('displaynone', false);
  },
});
