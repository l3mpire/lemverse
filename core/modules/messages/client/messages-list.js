import { messageModerationAllowed } from '../misc';
import { currentLevel } from '../../../lib/misc';

function computeReactionToolboxPosition(element) {
  const elemRect = element.getBoundingClientRect();
  const parentRect = document.querySelector('.right-content').getBoundingClientRect();

  return {
    left: elemRect.left - parentRect.left + window.scrollX,
    top: elemRect.top - parentRect.top + window.scrollY,
  };
}

const getCurrentChannelName = () => {
  const channel = Session.get('messagesChannel');
  if (!channel) return '-';

  if (channel.includes('zon_')) return Zones.findOne(channel)?.name || 'Zone';
  else if (channel.includes('lvl_')) return currentLevel(Meteor.user())?.name || 'Level';
  else if (channel.includes('qst_')) return '';

  const userIds = channel.split(';');
  const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
  const userNames = users.map(user => user.profile.name);

  return userNames.join(' & ');
};

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

const collectionDependenciesCount = 2; // users and files

Template.messagesListMessage.onCreated(function () {
  this.moderationAllowed = messageModerationAllowed(Meteor.user(), this.data.message);
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
  reactions() {
    const userId = Meteor.userId();
    return Object.entries(this.message.reactions || []).map(reaction => ({ reaction: reaction[0], amount: reaction[1].length, owner: reaction[1].indexOf(userId) > -1 }));
  },
});

Template.messagesListMessage.events({
  'click .js-username'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const userId = templateInstance.data.message.createdBy;
    if (userId) Session.set('modal', { template: 'userProfile', userId });
  },
  'click .js-message-remove'(event, templateInstance) {
    const messageId = templateInstance.data.message._id;
    lp.notif.confirm('Delete message', `Do you really want to delete this message?`, () => Messages.remove(messageId));
  },
  'click .js-message-open-reactions-box'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const messageId = templateInstance.data.message._id;
    const position = computeReactionToolboxPosition(event.target);
    Session.set('messageReaction', { messageId, x: position.left, y: position.top });
  },
  'click .js-message-reaction'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const messageId = templateInstance.data.message._id;
    Meteor.call('toggleMessageReaction', messageId, event.target.dataset.reaction);
  },
  'load .files img'() { scrollToBottom(); },
});

Template.messagesList.onCreated(function () {
  this.userSubscribeHandler = undefined;
  this.fileSubscribeHandler = undefined;
  this.loadedDependencies = new ReactiveVar(false);
  this.messages = new ReactiveVar();

  this.autorun(() => {
    const consoleOpen = Session.get('console');
    const messages = Messages.find({}, { fields: { createdBy: 1, fileId: 1 } }).fetch();

    Tracker.nonreactive(async () => {
      this.loadedDependencies.set(0);

      if (!messages.length) {
        this.fileSubscribeHandler?.stop();
        this.userSubscribeHandler?.stop();
        this.messages.set(undefined);
        return;
      }

      if (!consoleOpen) {
        this.fileSubscribeHandler?.stop();
        this.userSubscribeHandler?.stop();
        this.messages.set(undefined);
        messagesModule.stopListeningMessagesChannel();
        return;
      }

      const userIds = messages.map(message => message.createdBy).filter(Boolean);
      this.userSubscribeHandler = this.subscribe('usernames', userIds, () => {
        this.loadedDependencies.set(+this.loadedDependencies.get() + 1);
      });

      const filesIds = messages.map(message => message.fileId).filter(Boolean);
      this.fileSubscribeHandler = this.subscribe('files', filesIds, () => {
        this.loadedDependencies.set(+this.loadedDependencies.get() + 1);
      });
    });

    // todo: find a better way to handle UI updates with asynchronous dependencies
    this.autorun(() => {
      if (this.loadedDependencies.get() < collectionDependenciesCount) return;

      Tracker.nonreactive(() => {
        this.messages.set(Messages.find({}, { sort: { createdAt: 1 } }).fetch());
        scrollToBottom();
      });
    });
  });
});

Template.messagesList.helpers({
  channelName() { return getCurrentChannelName(); },
  messages() { return Template.instance().messages.get(); },
  canSubscribe() { return Session.get('messagesChannel')?.includes('zon_'); },
  subscribed() {
    const channel = Session.get('messagesChannel');
    if (!channel?.includes('zon_')) return false;

    const { zoneLastSeenDates } = Meteor.user();
    return !zoneLastSeenDates || !zoneLastSeenDates[channel];
  },
  muted() {
    const channel = Session.get('messagesChannel');
    if (!channel?.includes('zon_')) return false;

    const { zoneMuted } = Meteor.user();
    return !zoneMuted || !zoneMuted[channel];
  },
  sameDay(index) {
    if (index === 0) return true;

    const messages = Template.instance().messages.get() || [];
    if (index >= messages.length) return true;
    return new Date(messages[index].createdAt).getDate() === new Date(messages[index - 1].createdAt).getDate();
  },
  formattedSeparationDate(index) {
    const messages = Template.instance().messages.get() || [];
    const messageDate = new Date(messages[index].createdAt);

    const date = new Date();
    if (messageDate.getDate() === date.getDate()) return 'Today';
    if (messageDate.getDate() === date.getDate() - 1) return 'Yesterday';

    return messageDate.toDateString();
  },
});

Template.messagesList.events({
  'click .js-channel-subscribe'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('updateZoneLastSeenDate', channelId, true, err => {
      if (err) return;
      lp.notif.success('🔔 You will be notified of news from this zone');
    });
  },
  'click .js-channel-unsubscribe'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('unsubscribeFromZone', channelId, err => {
      if (err) return;
      lp.notif.success('🔔 You will no longer be notified');
    });
  },
  'click .js-channel-mute'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('muteFromZone', channelId, true, err => {
      if (err) return;
      lp.notif.success('Notifications on this channel are now without sound 🔕 ... soundlessness and silence ...');
    });
  },
  'click .js-channel-unmute'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('unmuteFromZone', channelId, err => {
      if (err) return;
      lp.notif.success('Notifications on this channel are now unmuted and hearable 🔔 !');
    });
  },
  'click .js-message-list-close'() { closeConsole(); },
});
