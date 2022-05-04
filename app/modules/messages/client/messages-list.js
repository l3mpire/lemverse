const getCurrentChannelName = () => {
  const channel = Session.get('messagesChannel');
  if (!channel) return '-';

  if (channel.includes('zon_')) return Zones.findOne(channel)?.name || 'Zone';
  else if (channel.includes('qst_')) return '';

  const userIds = channel.split(';');
  const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
  const userNames = users.map(user => user.profile.name);

  return userNames.join(' & ');
};

const sortedMessages = () => Messages.find({}, { sort: { createdAt: 1 } }).fetch();

const scrollToBottom = () => {
  const messagesElement = document.querySelector('.messages-list');
  if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
};

const formatText = text => {
  let finalText = lp.purify(text);
  finalText = formatURLs(finalText);
  finalText = replaceTextVars(finalText);

  return finalText.replace(/(?:\r\n|\r|\n)/g, '<br>');
};

Template.messagesListMessage.onCreated(function () {
  this.moderationAllowed = messageModerationAllowed(Meteor.userId(), this.data.message);
});

Template.messagesListMessage.helpers({
  user() { return Meteor.users.findOne(this.message.createdBy); },
  userName() { return Meteor.users.findOne(this.message.createdBy)?.profile.name || '[removed]'; },
  text() { return formatText(this.message.text); },
  file() {
    if (!this.message.fileId) return undefined;
    return Files.findOne(this.message.fileId);
  },
  date() { return this.message.createdAt.toDateString(); },
  time() { return this.message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
  showActions() { return Template.instance().moderationAllowed; },
});

Template.messagesListMessage.events({
  'click .js-username'(e, instance) {
    e.preventDefault();
    e.stopPropagation();
    const userId = instance.data.message.createdBy;
    if (userId) Session.set('modal', { template: 'profile', userId });
  },
  'click .js-message-remove'(e, instance) {
    const messageId = instance.data.message._id;
    lp.notif.confirm('Delete message', `Do you really want to delete this message?`, () => Messages.remove(messageId));
  },
  'load .files img'() { scrollToBottom(); },
});

Template.messagesList.onCreated(function () {
  this.userSubscribeHandler = undefined;
  this.fileSubscribeHandler = undefined;

  this.autorun(() => {
    if (!Session.get('console')) {
      this.fileSubscribeHandler?.stop();
      this.userSubscribeHandler?.stop();
      messagesModule.stopListeningMessagesChannel();
      return;
    }

    const messages = Messages.find({}, { fields: { createdBy: 1, fileId: 1 } }).fetch();

    const userIds = messages.map(message => message.createdBy).filter(Boolean);
    this.userSubscribeHandler = this.subscribe('usernames', userIds, () => scrollToBottom());

    const filesIds = messages.map(message => message.fileId).filter(Boolean);
    this.fileSubscribeHandler = this.subscribe('files', filesIds);
  });
});

Template.messagesList.helpers({
  channelName() { return getCurrentChannelName(); },
  messages() { return sortedMessages(); },
  canSubscribe() { return Session.get('messagesChannel')?.includes('zon_'); },
  subscribed() {
    const channel = Session.get('messagesChannel');
    if (!channel?.includes('zon_')) return false;

    const { zoneLastSeenDates } = Meteor.user();
    return !zoneLastSeenDates || !zoneLastSeenDates[channel];
  },
  sameDay(index) {
    if (index === 0) return true;

    const messages = sortedMessages();
    if (index >= messages.length) return true;
    return new Date(messages[index].createdAt).getDate() === new Date(messages[index - 1].createdAt).getDate();
  },
  formattedSeparationDate(index) {
    const messages = sortedMessages();
    const messageDate = new Date(messages[index].createdAt);

    const date = new Date();
    if (messageDate.getDate() === date.getDate()) return 'Today';
    if (messageDate.getDate() === date.getDate() - 1) return 'Yesterday';

    return messageDate.toDateString();
  },
});

Template.messagesList.events({
  'click .js-channel-subscribe'(e) {
    e.preventDefault();
    e.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('updateZoneLastSeenDate', channelId, true, err => {
      if (err) return;
      lp.notif.success('🔔 You will be notified of news from this zone');
    });
  },
  'click .js-channel-unsubscribe'(e) {
    e.preventDefault();
    e.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('unsubscribeFromZone', channelId, err => {
      if (err) return;
      lp.notif.success('🔔 You will no longer be notified');
    });
  },
  'click .js-message-list-close'() { closeConsole(); },
});
