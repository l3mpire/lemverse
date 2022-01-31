Meteor.publish('items', function (itemIds) {
  check(itemIds, [String]);
  if (!this.userId) return '';

  const { levelId } = Meteor.user().profile;
  return Items.find({ _id: { $in: itemIds }, $or: [{ levelId: { $exists: false } }, { levelId }] });
});
