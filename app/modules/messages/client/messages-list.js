const getCurrentChannelName = () => {
  const messages = Messages.find().fetch();
  if (!messages.length) return '-';

  const channels = messages.map(message => message.channel);
  const channelItems = [...new Set(channels)];

  if (channelItems.length === 1) return Zones.findOne(channelItems[0])?.name || 'Zone';

  const users = Meteor.users.find({ _id: { $in: channelItems } }).fetch();
  const userNames = users.map(user => user.profile.name);

  return userNames.split(' & ');
};

Template.messagesListMessage.helpers({
  user() { return Meteor.users.findOne(this.message.createdBy); },
  userName() { return Meteor.users.findOne(this.message.createdBy)?.profile.name || '[removed]'; },
  text() { return this.message.text; },
  date() { return this.message.createdAt.toDateString(); },
  time() { return this.message.createdAt.toLocaleTimeString(); },
});

Template.messagesList.onCreated(function () {
  this.autorun(() => {
    document.querySelector('.messages-list')?.scrollIntoView();
    const messages = Messages.find({}, { fields: { createdBy: 1 } }).fetch();
    const userIds = messages.map(message => message.createdBy).filter(Boolean);
    if (userIds?.length) this.subscribe('usernames', userIds);
  });
});

Template.messagesList.helpers({
  show() { return Session.get('console') && Messages.find().count(); },
  channelName() { return getCurrentChannelName(); },
  messages() { return Messages.find({}, { sort: { createdAt: -1 } }).fetch(); },
});
