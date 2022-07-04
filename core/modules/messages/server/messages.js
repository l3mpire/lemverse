import { messagingAllowed } from '../misc';

const limit = 20;

// todo: remove the old "questId" attribute from notifications (the new field is "channelId") + simplify notifications queries
const removePreviousNotifications = ({ channel, createdBy }) => {
  Notifications.remove({ $or: [{ questId: channel }, { channelId: channel }], userId: { $ne: createdBy } });
};

const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  log('notifyQuestSubscribersAboutNewMessage: start', { questId, message });
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const targets = (quest.targets || []);

  // When someone has joined the quest we stop sending notifications to all subscribed users
  const subscribedUsers = targets.length > 0 ? [] : subscribedUsersToEntity(quest.origin).map(u => u._id);
  targets.push(quest.createdBy);

  const usersToNotify = [...new Set([...subscribedUsers, ...targets])].filter(userId => userId !== message.createdBy);
  if (!usersToNotify.length) {
    log('notifyQuestSubscribersAboutNewMessage: no subscribed users or targets');
    return;
  }

  removePreviousNotifications(message);

  const questMessageCount = Messages.find({ channel: questId }).count();
  const type = questMessageCount > 1 ? 'quest-updated' : 'quest-new';

  const notifications = usersToNotify.map(userId => ({
    _id: Notifications.id(),
    channelId: questId,
    userId,
    createdAt: new Date(),
    createdBy: message.createdBy,
    type,
  }));

  Notifications.rawCollection().insertMany(notifications);
  log('notifyQuestSubscribersAboutNewMessage: done', { amount: usersToNotify.length });
};

const setZoneLastMessageAtToNow = zoneId => Zones.update(zoneId, { $set: { lastMessageAt: new Date() } });

const notifyUsers = (channel, message) => {
  log('notifyUsers: start', { channel });

  removePreviousNotifications(message);

  const userIds = channel.split(';').filter(userId => userId !== message.createdBy);
  const notifications = userIds.map(userId => ({
    _id: Notifications.id(),
    channelId: channel,
    userId,
    createdAt: new Date(),
    createdBy: message.createdBy,
  }));
  Notifications.rawCollection().insertMany(notifications);

  log('notifyUsers: done', { userIds });
};

const context = channel => {
  if (channel.includes('zon_')) return 'zone';
  if (channel.includes('usr_')) return 'discussion';
  if (channel.includes('qst_')) return 'quest';

  return 'unknown';
};

Meteor.startup(() => {
  Messages.find({ createdAt: { $gte: new Date() } }).observe({
    added(message) {
      if (message.channel.includes('qst_')) notifyQuestSubscribersAboutNewMessage(message.channel, message);
      else if (message.channel.includes('zon_')) setZoneLastMessageAtToNow(message.channel);
      else if (message.channel.includes('usr_')) notifyUsers(message.channel, message);
    },
  });
});

Meteor.publish('messages', function (channel) {
  check(channel, String);
  if (!this.userId) return undefined;
  if (!messagingAllowed(channel, this.userId)) throw new Meteor.Error('not-authorized', 'Access not allowed');

  return Messages.find({ channel }, { sort: { createdAt: -1 }, limit });
});

Meteor.methods({
  sendMessage(channel, text, fileId) {
    if (!this.userId) return undefined;

    log('sendMessage: start', { channel, text, fileId, userId: this.userId });
    check([channel, text], [String]);
    check(fileId, Match.Maybe(String));

    if (!messagingAllowed(channel, this.userId)) throw new Meteor.Error('not-authorized', 'Not allowed');

    const messageId = Messages.id();
    Messages.insert({
      _id: messageId,
      channel,
      text,
      fileId,
      createdAt: new Date(),
      createdBy: this.userId,
    });

    analytics.track(this.userId, '✍️ Message Sent', { user_id: this.userId, context: context(channel) });
    log('sendMessage: done', { messageId });

    return messageId;
  },
  toggleMessageReaction(messageId, reaction) {
    if (!this.userId) return;

    check(messageId, Match.Id);
    check(reaction, String);

    let message = Messages.findOne(messageId);
    if (!message) throw new Meteor.Error('not-found', 'Not found');

    if (!message.reactions || !message.reactions[reaction]?.includes(this.userId)) {
      Messages.update(messageId, { $addToSet: { [`reactions.${reaction}`]: this.userId } });
    } else {
      Messages.update(messageId, { $pull: { [`reactions.${reaction}`]: this.userId } });
    }

    message = Messages.findOne(messageId);
    if (message.reactions[reaction].length === 0) Messages.update(messageId, { $unset: { [`reactions.${reaction}`]: 1 } });
  },
});
