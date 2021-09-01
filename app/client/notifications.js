const formatedDuration = value => {
  if (value === 0 || value === Infinity) return '00:00';

  const minutes = Math.floor(value % 3600 / 60).toString().padStart(2, '0');
  const seconds = Math.floor(Math.max(value % 60, 1)).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const markAsRead = template => {
  template._playing.set(false);
  Meteor.call('markNotificationAsRead', template.data._id);
};

Template.notificationsItem.onCreated(function () {
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

Template.notificationsItem.helpers({
  date() {
    return moment(this.createdAt).calendar();
  },
  duration() {
    return formatedDuration(Template.instance()._duration.get());
  },
  isPlaying() {
    return Template.instance()._playing.get();
  },
  author() {
    const { createdBy } = Template.instance().data;
    return Meteor.users.findOne(createdBy)?.profile.name || createdBy;
  },
});

Template.notificationsItem.events({
  'click .js-play'(event, template) {
    event.preventDefault();

    template._playing.set(true);
    if (template.audio.paused && template.audio.currentTime > 0 && !template.audio.ended) template.audio.play();
    else if (!template.audio.paused && template.audio.currentTime > 0 && !template.audio.ended) {
      template.audio.pause();
      template._playing.set(false);
    } else {
      template.audio.currentTime = 0;
      template.audio.volume = 1;
      template.audio.play();

      template.audio.removeEventListener('ended', markAsRead);
      template.audio.addEventListener('ended', markAsRead.bind(this, template));
    }
  },
});

Template.notifications.onCreated(function () {
  this.autorun(() => {
    const notifications = Notifications.find({}, { fields: { createdBy: 1 } }).fetch();
    const userIds = notifications.map(notification => notification.createdBy).filter(Boolean);
    if (userIds?.length) this.subscribe('usernames', userIds);
  });
});

Template.notifications.helpers({
  notifications() {
    return Notifications.find().fetch().sort((a, b) => b.createdAt - a.createdAt);
  },
});

Template.notifications.events({
  'click .js-close'(event) {
    event.preventDefault();
    Session.set('displayNotificationsPanel', false);
  },
});
