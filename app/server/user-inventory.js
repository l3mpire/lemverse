addToInventory = (user, inventoryItems) => {
  if (!user) throw new Meteor.Error(404, 'User not found.');

  const userInventory = user.inventory || [];
  inventoryItems.forEach(({ itemId, amount }) => {
    userInventory[itemId] = amount + Math.abs(userInventory[itemId] || 0);
  });

  Meteor.users.update(user._id, { $set: { inventory: userInventory } });
};

removeFromInventory = (user, inventoryItems) => {
  if (!user) throw new Meteor.Error(404, 'User not found.');

  const itemsEdited = {};
  const userInventory = user.inventory || [];
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
