Meteor.publish('items', function (itemIds) {
  check(itemIds, [String]);
  if (!this.userId) return '';

  return Items.find(
    { _id: { $in: itemIds } },
    { fields: { name: 1, description: 1, thumbnail: 1 } },
  );
});
