const dropInventoryItem = (itemId, data = {}) => {
  log('dropInventoryItem: start', { itemId, data });
  const item = Items.findOne(itemId);
  if (!item) throw new Meteor.Error(404, 'Item not found.');

  const user = Meteor.user();
  if (!user.inventory || user.inventory[itemId] < 1) throw new Meteor.Error(404, 'Item not found in the inventory.');

  const itemsEdited = removeFromInventory(user, [{ itemId, amount: data.amount || 1 }]);
  if (Object.keys(itemsEdited).length === 1) createEntityFromItem(item, data);
  else throw new Meteor.Error(404, 'Inventory not updated: item not found in the user inventory.');

  return itemsEdited;
};

Meteor.methods({
  dropInventoryItem(itemId, data = {}) {
    check(itemId, String);
    check(data, Object);

    return dropInventoryItem(itemId, data);
  },
});
