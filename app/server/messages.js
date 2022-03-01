const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  log('notifyQuestSubscribersAboutNewMessage: start', { questId, message });
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const subscribedUsers = subscribedUsersToEntity(quest.origin).map(u => u._id);
  const targets = (quest.targets || []);
  targets.push(quest.createdBy);

  const usersToNotify = [...new Set([...subscribedUsers, ...targets])].filter(userId => userId !== message.createdBy);
  if (!usersToNotify.length) {
    log('notifyQuestSubscribersAboutNewMessage: no subscribed users or targets');
    return;
  }

  // remove all previous notifications for this quest ('upsert' can't be used in a bulk operation and with a custom id)
  Notifications.remove({ questId, userId: { $ne: message.createdBy } });

  const notifications = usersToNotify.map(userId => ({
    _id: Notifications.id(),
    questId,
    userId,
    read: false,
    createdAt: new Date(),
    createdBy: message.createdBy,
  }));

  Notifications.rawCollection().insertMany(notifications);
  log('notifyQuestSubscribersAboutNewMessage: done', { amount: usersToNotify.length });
};

Messages.find({ createdAt: { $gte: new Date() } }).observe({
  added(message) {
    if (!message.channel.includes('qst_')) return;
    notifyQuestSubscribersAboutNewMessage(message.channel, message);
  },
});
