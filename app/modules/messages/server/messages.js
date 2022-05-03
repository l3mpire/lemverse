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

  return Messages.find({ channel }, { sort: { createdAt: -1 }, limit });
});
