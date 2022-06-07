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
  log('removeFromInventory: start', { userId: user._id, inventory: user.inventory, inventoryItems });
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

const dropInventoryItem = (itemId, options = {}) => {
  log('dropInventoryItem: start', { itemId, options });
  const item = Items.findOne(itemId);
  if (!item) throw new Meteor.Error(404, 'Item not found.');

  const user = Meteor.user();
  if (!user.inventory || user.inventory[itemId] < 1) throw new Meteor.Error(404, 'Item not found in the inventory.');

  const itemsEdited = removeFromInventory(user, [{ itemId, amount: options.amount || 1 }]);
  if (Object.keys(itemsEdited).length === 1) {
    log('dropInventoryItem: drop item', { item });
    if (!item.entityId) throw new Error(`The item isn't linked to an entity`);

    spawnEntityFromPrefab(item.entityId, {
      ...options,
      levelId: user.profile.levelId,
    });
  } else throw new Meteor.Error(404, 'Inventory not updated: item not found in the user inventory.');

  return itemsEdited;
};

Meteor.methods({
  dropInventoryItem(itemId, options = {}) {
    check(itemId, String);
    check(options, { x: Number, y: Number });

    return dropInventoryItem(itemId, options);
  },
});
