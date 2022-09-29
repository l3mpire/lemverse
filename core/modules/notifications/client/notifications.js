const notifsReadMaxDisplayed = 20;

const formatedDuration = value => {
  if (value === 0 || value === Infinity) return '00:00';

  const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(Math.max(value % 60, 1)).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const resetPlayButtonState = template => template._playing.set(false);

const markNotificationAsRead = notificationId => Meteor.call('markNotificationAsRead', notificationId);

const markAllNotificationsAsRead = () => Meteor.call('markAllNotificationsAsRead');

const isQuestNotification = notification => notification.questId || notification.channelId?.includes('qst_');

Template.notificationsAudioPlayer.onCreated(function () {
  this._duration = new ReactiveVar(0);
  this._playing = new ReactiveVar(false);
  this.audio = new Audio(`/api/files/${this.data.fileId}`);

  // trick to get duration
  this.audio.load();
  this.audio.currentTime = 24 * 60 * 60;
  this.audio.volume = 0;
  this.audio.play();

  this.audio.addEventListener('durationchange', () => {
    if (this.audio.duration !== Infinity) this._duration.set(this.audio.duration);
  }, false);
  this.audio.addEventListener('timeupdate', () => this._duration.set(this.audio.currentTime), false);
});

Template.notificationsAudioPlayer.onDestroyed(function () {
  this.audio.pause();
});

Template.notificationsAudioPlayer.helpers({
  duration() { return formatedDuration(Template.instance()._duration.get()); },
  isPlaying() { return Template.instance()._playing.get(); },
});

Template.notificationsAudioPlayer.events({
  'click .js-play'(event, templateInstance) {
    event.preventDefault();
    markNotificationAsRead(templateInstance.data._id);

    templateInstance._playing.set(true);
    if (templateInstance.audio.paused && templateInstance.audio.currentTime > 0 && !templateInstance.audio.ended) templateInstance.audio.play();
    else if (!templateInstance.audio.paused && templateInstance.audio.currentTime > 0 && !templateInstance.audio.ended) {
      templateInstance.audio.pause();
      templateInstance._playing.set(false);
    } else {
      templateInstance.audio.currentTime = 0;
      templateInstance.audio.volume = 1;
      templateInstance.audio.play();

      templateInstance.audio.removeEventListener('ended', resetPlayButtonState);
      templateInstance.audio.addEventListener('ended', resetPlayButtonState.bind(this, templateInstance));
    }
  },
});

Template.notificationButton.helpers({
  pendingNotificationsCount() { return Notifications.find({ read: { $exists: false } }).count(); },
});

Template.notification.helpers({
  date() { return moment(this.createdAt).calendar(); },
  user() { return Meteor.users.findOne(Template.instance().data.createdBy); },
  quest() { return isQuestNotification(this); },
  newQuest() { return this.type === 'quest-new'; },
});

Template.notification.events({
  'click .js-notification-clickable'(event) {
    event.preventDefault();
    markNotificationAsRead(this._id);
    window.dispatchEvent(new CustomEvent(eventTypes.onNotificationClicked, { detail: { notification: this } }));
  },
});

Template.notifications.events({
  'click .js-notification-mark-all-as-read'(event) {
    event.preventDefault();
    markAllNotificationsAsRead();
    closeModal('notifications');
  },
});

Template.notifications.onCreated(function () {
  const notifications = Notifications.find({}, { fields: { createdBy: 1 } }).fetch();
  const userIds = notifications.map(notification => notification.createdBy).filter(Boolean);
  if (userIds?.length) this.subscribe('usernames', userIds);
});

Template.notifications.helpers({
  notifications() {
    const notifsRead = Notifications.find({ read: true }, { sort: { createdAt: -1 }, limit: notifsReadMaxDisplayed }).fetch();
    const notifsUnread = Notifications.find({ read: { $ne: true } }, { sort: { createdAt: -1 } }).fetch();

    return notifsRead.concat(notifsUnread).sort((a, b) => b.createdAt - a.createdAt);
  },
});

const blobToBase64 = blob => new Promise(resolve => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

const fileIdToBitmap = async fileId => {
  const result = await fetch(`/api/files/${fileId}`);
  const blob = await result.blob();
  return createImageBitmap(blob);
};

const userAvatar = async user => {
  const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;
  const characterFileIds = Object.keys(charactersParts).flatMap(part => Characters.findOne(user.profile[part])?.fileId).filter(Boolean);

  const imageBitmaps = await Promise.all(characterFileIds.map(fileIdToBitmap));
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  imageBitmaps.forEach(img => canvas.getContext('2d').drawImage(img, 48, 0, frameWidth, frameHeight, 16, 0, frameWidth, frameHeight));

  const blob = await new Promise(resolve => canvas.toBlob(resolve));
  return blobToBase64(blob);
};

notify = async (userPoly, message) => {
  if (!document.hidden) return undefined;
  if (!('Notification' in window) || Notification.permission === 'denied') return undefined;
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return undefined;
  let title = '';
  const options = {};

  const user = lp.up(userPoly);
  if (user) {
    try {
      options.icon = await userAvatar(user);
    } catch (err) { log('failed to get user avatar', { err }); }

    title = user.profile.name;
    options.body = message;
  } else title = message;

  return new Notification(title, options);
};
