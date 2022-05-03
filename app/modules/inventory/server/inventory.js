addToInventory = (user, inventoryItems) => {
  log('addToInventory: start', { user, inventoryItems });
  if (!user) throw new Meteor.Error(404, 'User not found.');

  const userInventory = user.inventory || {};
  inventoryItems.forEach(({ itemId, amount }) => {
    userInventory[itemId] = amount + Math.abs(userInventory[itemId] || 0);
  });

  Meteor.users.update(user._id, { $set: { inventory: userInventory } });
};

removeFromInventory = (user, inventoryItems) => {
  log('removeFromInventory: start', { user, inventoryItems });
  if (!user) throw new Meteor.Error(404, 'User not found.');

  const itemsEdited = {};
  const userInventory = user.inventory || {};
  inventoryItems.forEach(({ itemId, amount }) => {
    if (!userInventory[itemId]) {
      delete userInventory[itemId];
      return;
    }

    userInventory[itemId] -= Math.abs(amount);
    if (userInventory[itemId] <= 0) delete userInventory[itemId];

    itemsEdited[itemId] = userInventory[itemId];
  });

  Meteor.users.update(user._id, { $set: { inventory: userInventory } });

  return itemsEdited;
};

const createEntityFromItem = (item, data = {}) => {
  log('createEntityFromItem: start', { item });
  if (!item.entityId) throw new Error(`The item isn't linked to an entity`);

  spawnEntityFromPrefab(item.entityId, data);
};

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
