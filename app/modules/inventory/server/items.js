const fields = { name: 1, description: 1, thumbnail: 1 };

Meteor.publish('items', function (itemIds) {
  check(itemIds, [String]);
  if (!this.userId) return '';

  return Items.find({ _id: { $in: itemIds } }, { fields });
});

Meteor.publish('levelItems', function () {
  if (!this.userId) return '';

  const { levelId } = Meteor.user().profile;
  return Items.find({ levelId }, { fields });
});
