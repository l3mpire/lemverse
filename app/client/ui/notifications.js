const formatedDuration = value => {
  if (value === 0 || value === Infinity) return '00:00';

  const minutes = Math.floor(value % 3600 / 60).toString().padStart(2, '0');
  const seconds = Math.floor(Math.max(value % 60, 1)).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const resetPlayButtonState = template => template._playing.set(false);

const markNotificationAsRead = notificationId => Meteor.call('markNotificationAsRead', notificationId);

Template.notificationsQuestItem.helpers({
  date() { return moment(this.createdAt).calendar(); },
  user() {
    const { createdBy } = Template.instance().data;
    return Meteor.users.findOne(createdBy);
  },
});

Template.notificationsQuestItem.events({
  'click .js-quest-name'(event) {
    event.preventDefault();

    markNotificationAsRead(this._id);
    Session.set('modal', undefined);
    Session.set('quests', { selectedQuestId: this.questId, origin: 'notifications' });
  },
});

Template.notificationsAudioItem.onCreated(function () {
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

Template.notificationsAudioItem.onDestroyed(function () {
  this.audio.pause();
});

Template.notificationsAudioItem.helpers({
  date() { return moment(this.createdAt).calendar(); },
  duration() { return formatedDuration(Template.instance()._duration.get()); },
  isPlaying() { return Template.instance()._playing.get(); },
  user() {
    const { createdBy } = Template.instance().data;
    return Meteor.users.findOne(createdBy);
  },
});

Template.notificationsAudioItem.events({
  'click .js-play'(event, template) {
    event.preventDefault();
    markNotificationAsRead(template.data._id);

    template._playing.set(true);
    if (template.audio.paused && template.audio.currentTime > 0 && !template.audio.ended) template.audio.play();
    else if (!template.audio.paused && template.audio.currentTime > 0 && !template.audio.ended) {
      template.audio.pause();
      template._playing.set(false);
    } else {
      template.audio.currentTime = 0;
      template.audio.volume = 1;
      template.audio.play();

      template.audio.removeEventListener('ended', resetPlayButtonState);
      template.audio.addEventListener('ended', resetPlayButtonState.bind(this, template));
    }
  },
});

Template.notifications.onCreated(function () {
  const notifications = Notifications.find({}, { fields: { createdBy: 1 } }).fetch();
  const userIds = notifications.map(notification => notification.createdBy).filter(Boolean);
  if (userIds?.length) this.subscribe('usernames', userIds);
});

Template.notifications.helpers({
  notifications() {
    return Notifications.find().fetch().sort((a, b) => b.createdAt - a.createdAt);
  },
});

notify = async message => {
  if (!document.hidden) return undefined;
  if (!('Notification' in window) || Notification.permission === 'denied') throw new Error('User refused notification');
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') throw new Error('Permission not granted');

  return new Notification(message);
};
