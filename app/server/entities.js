switchEntityState = (entity, forcedState = undefined) => {
  if (!entity || !entity.states) throw new Error(`Entity without state`);

  const newState = forcedState !== undefined ? forcedState : !entity.state;
  const state = newState ? entity.states[1] : entity.states[0];
  const { levelId } = entity;

  state.remove?.forEach(t => Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index }));

  state.add?.forEach(t => Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() }));

  state.replace?.forEach(t => Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } }));

  Entities.update(entity._id, { $set: { state: newState } });
};

createEntityFromItem = (item, data = {}) => {
  log('createEntityFromItem: start', { item });
  if (!item.entity) throw new Error(`The item isn't linked to an entity`);

  const entityPrefab = Entities.findOne(item.entity);
  if (!entityPrefab) throw new Error(`The entity linked to the item doesn't exists`);

  const { levelId, x, y } = Meteor.user().profile;
  Entities.insert({
    ...entityPrefab,
    _id: Entities.id(),
    levelId: data.levelId || levelId,
    x: data.x || x,
    y: data.y || y,
    createdBy: Meteor.userId(),
    createdAt: new Date(),
  });
};

const pickEntityInventory = entity => {
  log('pickEntityInventory: start', { entity });
  const inventoryItemKeys = Object.keys(entity.inventory || {});
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
    if (!entity) throw new Meteor.Error(404, 'Entity not found.');

    if (!entity.actionType || entity.actionType === entityActionType.actionable) switchEntityState(entity, value);
    else if (entity.actionType === entityActionType.pickable) pickEntityInventory(entity, value);
    else throw new Error('entity action not implemented');

    return entity;
  },
});
