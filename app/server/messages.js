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

  // remove all previous notifications for this quest ('upsert' can't be used in a bulk operation and with a custom id)
  Notifications.remove({ questId, userId: { $ne: message.createdBy } });

  const questMessageCount = Messages.find({ channel: questId }).count();
  const type = questMessageCount > 1 ? 'quest-updated' : 'quest-new';

  const notifications = usersToNotify.map(userId => ({
    _id: Notifications.id(),
    questId,
    userId,
    createdAt: new Date(),
    createdBy: message.createdBy,
    type,
  }));

  Notifications.rawCollection().insertMany(notifications);
  log('notifyQuestSubscribersAboutNewMessage: done', { amount: usersToNotify.length });
};

const setZoneLastMessageAtToNow = zoneId => Zones.update(zoneId, { $set: { lastMessageAt: new Date() } });

Messages.find({ createdAt: { $gte: new Date() } }).observe({
  added(message) {
    if (message.channel.includes('qst_')) notifyQuestSubscribersAboutNewMessage(message.channel, message);
    else if (message.channel.includes('zon_')) setZoneLastMessageAtToNow(message.channel);
  },
});
