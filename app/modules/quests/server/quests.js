Meteor.publish('quests', function () {
  if (!this.userId) return undefined;

  return Quests.find({
    $or: [
      { owners: { $in: [Meteor.userId()] } },
      { createdBy: Meteor.userId() },
    ],
  }, { sort: { completed: 1, createdAt: 1 } });
});
