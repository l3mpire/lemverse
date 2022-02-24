Meteor.publish('quests', function () {
  if (!this.userId) return undefined;

  const { entitySubscriptionIds } = Meteor.user();
  return Quests.find({ origin: { $in: entitySubscriptionIds } }, { sort: { completed: 1, createdAt: 1 } });
});
