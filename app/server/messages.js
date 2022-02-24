const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const subscribedUsers = subscribedUsersToEntity(quest.origin);
  if (!subscribedUsers.length) return;

  const notifications = subscribedUsers.map(user => ({
    _id: Notifications.id(),
    questId,
    userId: user._id,
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
