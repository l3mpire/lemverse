const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const subscribedUsers = subscribedUsersToEntity(quest.origin).filter(u => u._id !== message.createdBy).map(u => u._id);
  const targets = (quest.targets || []);
  const usersToNotify = [...new Set([...subscribedUsers, ...targets])];

  const notifications = usersToNotify.map(userId => ({
    _id: Notifications.id(),
    questId,
    userId,
    read: false,
    createdAt: new Date(),
    createdBy: message.createdBy,
  }));

  Notifications.rawCollection().insertMany(notifications);
};

Messages.find().observe({
  added(message) {
    if (!message.channel.includes('qst_')) return;
    notifyQuestSubscribersAboutNewMessage(message.channel, message);
  },
});
