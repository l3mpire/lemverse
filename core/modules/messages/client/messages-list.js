import { canSubscribeToNotifications, messageModerationAllowed } from '../misc';
import { getCurrentChannelName, formatDate, formatText, show } from './helpers';

function computeReactionToolboxPosition(element) {
  const elemRect = element.getBoundingClientRect();
  const parentRect = document.querySelector('.right-content').getBoundingClientRect();

  return {
    left: elemRect.left - parentRect.left + window.scrollX,
    top: elemRect.top - parentRect.top + window.scrollY,
  };
}

const sortedMessages = () => Messages.find({}, { sort: { createdAt: 1 } }).fetch();

const scrollToBottom = () => {
  Tracker.afterFlush(() => {
    const messagesElement = document.querySelector('.messages-list');
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  });
};

Template.messagesListMessage.onCreated(function () {
  this.moderationAllowed = messageModerationAllowed(Meteor.user(), this.data.message);
});

Template.messagesListMessage.helpers({
  user() { return Meteor.users.findOne(this.message.createdBy); },
  userName() { return Meteor.users.findOne(this.message.createdBy)?.profile.name || 'Guest'; },
  text() { return formatText(this.message.text); },
  file() {
    if (!this.message.fileId) return undefined;
    return Files.findOne(this.message.fileId);
  },
  date() { return this.message.createdAt.toDateString(); },
  time() { return this.message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
  showActions() { return Template.instance().moderationAllowed; },
  isOwner() { return this.message.createdBy === Meteor.userId(); },
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
  'click .js-message-report'(event, templateInstance) {
    const messageId = templateInstance.data.message._id;
    const userId = templateInstance.data.message.createdBy;
    Session.set('modal', { template: 'report', userId, messageId });
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
  Session.set('messagesUI', false);
  this.userSubscribeHandler = undefined;
  this.fileSubscribeHandler = undefined;

  this.autorun(() => {
    if (Session.get('console')) return;

    Tracker.nonreactive(() => {
      Session.set('messagesUI', false);
    });
  });

  this.autorun(() => {
    if (!Session.get('messagesUI')) {
      this.fileSubscribeHandler?.stop();
      this.userSubscribeHandler?.stop();
      messagesModule.stopListeningMessagesChannel();
      return;
    }

    const messages = Messages.find({}, { fields: { createdBy: 1, fileId: 1 } }).fetch();

    const userIds = messages.map(message => message.createdBy).filter(Boolean);
    this.userSubscribeHandler = this.subscribe('usernames', userIds, scrollToBottom);

    const filesIds = messages.map(message => message.fileId).filter(Boolean);
    this.fileSubscribeHandler = this.subscribe('files', filesIds, scrollToBottom);
  });
});

Template.messagesList.helpers({
  channelName() { return getCurrentChannelName(); },
  messages() { return sortedMessages(); },
  canSubscribe() {
    return canSubscribeToNotifications(Session.get('messagesChannel'));
  },
  subscribed() {
    const channelId = Session.get('messagesChannel');
    if (!canSubscribeToNotifications(channelId)) return false;

    const { zoneLastSeenDates } = Meteor.user({ fields: { zoneLastSeenDates: 1 } });
    return !zoneLastSeenDates || !zoneLastSeenDates[channelId];
  },
  muted() {
    const channelId = Session.get('messagesChannel');
    if (!canSubscribeToNotifications(channelId)) return false;

    const { zoneMuted } = Meteor.user({ fields: { zoneMuted: 1 } });
    return !zoneMuted || !zoneMuted[channelId];
  },
  sameDay(index) {
    if (index === 0) return true;

    const messages = sortedMessages();
    if (index >= messages.length) return true;
    return new Date(messages[index].createdAt).getDate() === new Date(messages[index - 1].createdAt).getDate();
  },
  formattedSeparationDate(index) {
    const messages = sortedMessages();
    return formatDate(new Date(messages[index].createdAt));
  },
  show() {
    return show();
  },
});

Template.messagesList.events({
  'click .js-channel-subscribe'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_') && !channelId.includes('lvl_')) return;
    Meteor.call('messagesUpdateChannelLastSeenDate', channelId, true, err => {
      if (err) return;
      lp.notif.success('🔔 You will be notified of news from this channel');
    });
  },
  'click .js-channel-unsubscribe'(event) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = Session.get('messagesChannel');
    if (!channelId.includes('zon_')) return;
    Meteor.call('messagesUnsubscribeFromChannelNotifications', channelId, err => {
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
