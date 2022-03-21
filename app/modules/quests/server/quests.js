Meteor.publish('quests', function () {
  if (!this.userId) return undefined;

  const { entitySubscriptionIds } = Meteor.user();
  return Quests.find(
    {
      $or: [
        { origin: { $in: entitySubscriptionIds } },
        { targets: this.userId },
        { createdBy: Meteor.userId() },
      ],
    },
    { sort: { completed: 1, createdAt: 1 } },
  );
});

Meteor.methods({
  questUsers(questId) {
    check(questId, String);

    const quest = Quests.findOne(questId);
    if (!quest) throw new Meteor.Error(404, 'Quest not found.');

    const userIds = quest.targets || [];
    userIds.push(quest.createdBy);

    return Meteor.users.find({ _id: { $in: userIds } }).fetch();
  },
});
