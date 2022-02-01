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
  const inventoryItemKeys = Object.keys(entity.inventory || []);
  if (!inventoryItemKeys.length) throw new Error('unable to pick an entity without inventory');

  // add entity items to inventory
  const itemsToAdd = inventoryItemKeys.map(key => ({ itemId: key, amount: entity.inventory[key] }));
  addToInventory(Meteor.user(), itemsToAdd);

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
