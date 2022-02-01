switchEntityState = (entity, forcedState = undefined) => {
  if (!entity || !entity.states) return;

  const newState = forcedState !== undefined ? forcedState : !entity.state;
  const state = newState ? entity.states[1] : entity.states[0];
  const { levelId } = entity;

  state.remove?.forEach(t => Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index }));

  state.add?.forEach(t => Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() }));

  state.replace?.forEach(t => Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } }));

  Entities.update(entity._id, { $set: { state: newState } });
};

const pickEntityInventory = entity => {
  if (!entity.inventory?.length) throw new Error('unable to pick an entity without inventory');

  const user = Meteor.user();
  const userInventory = user.inventory || [];
  entity.inventory.forEach(entityInventoryItem => {
    const userInventoryItemIndex = user.inventory.findIndex(inventoryItem => inventoryItem.itemId === entityInventoryItem.itemId);
    const userInventoryItem = userInventory[userInventoryItemIndex];

    const updatedUserInventoryItem = { itemId: entityInventoryItem.itemId, amount: entityInventoryItem.amount };
    updatedUserInventoryItem.amount += Math.abs(userInventoryItem?.amount || 0);

    userInventory[userInventoryItemIndex] = updatedUserInventoryItem;
  });

  // update inventory
  Meteor.users.update(Meteor.userId(), { $set: { inventory: userInventory } });

  // remove the entity from the level
  Entities.remove(entity._id);
};

Meteor.methods({
  useEntity(entityId, value = undefined) {
    check(entityId, String);

    const entity = Entities.findOne(entityId);
    if (!entity.actionType || entity.actionType === entityActionType.actionable) switchEntityState(entity, value);
    else if (entity.actionType === entityActionType.pickable) pickEntityInventory(entity, value);
    else throw new Error('entity action not implemented');
  },
});
