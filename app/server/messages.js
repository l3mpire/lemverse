const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  log('notifyQuestSubscribersAboutNewMessage: start', { questId, message });
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const subscribedUsers = subscribedUsersToEntity(quest.origin).filter(u => u._id !== message.createdBy).map(u => u._id);
  const targets = (quest.targets || []);
  const usersToNotify = [...new Set([...subscribedUsers, ...targets])];
  if (!usersToNotify.length) {
    log('notifyQuestSubscribersAboutNewMessage: no subscribed users or targets');
    return;
  }

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
