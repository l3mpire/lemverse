const applyEntityState = (entity, stateActions) => {
  const { levelId } = entity;

  stateActions.remove?.forEach(t => Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index }));

  stateActions.add?.forEach(t => Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() }));

  stateActions.replace?.forEach(t => Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } }));
};

switchEntityState = (entity, forcedState = undefined) => {
  check(forcedState, Match.Maybe(String));
  log('switchEntityState: start', { entity, forcedState });
  if (!entity || !entity.states) throw new Error(`Entity without states`);

  const toggledState = entity.state === 'on' ? 'off' : 'on';
  const newState = forcedState !== undefined ? forcedState : toggledState;

  let stateActions;
  // todo: remove this condition once the migration to the new format is done in production
  if (Array.isArray(entity.states)) stateActions = newState === 'on' ? entity.states[1] : entity.states[0];
  else stateActions = entity.state[newState];

  if (!stateActions) {
    log('Invalid state', { entity, newState });
    return;
  }

  applyEntityState(entity, stateActions);
  Entities.update(entity._id, { $set: { state: newState } });

  log('switchEntityState: done', { entity, newState });
};

createEntityFromItem = (item, data = {}) => {
  log('createEntityFromItem: start', { item });
  if (!item.entityId) throw new Error(`The item isn't linked to an entity`);

  const entityPrefab = Entities.findOne(item.entityId);
  if (!entityPrefab) throw new Error(`The entity linked to the item doesn't exists (${item.entityId})`);

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
  if (!inventoryItemKeys.length) throw new Error(`entity's inventory is empty`);

  // adds the entity's items to the user's inventory
  const itemsToAdd = inventoryItemKeys.map(key => ({ itemId: key, amount: entity.inventory[key] }));
  addToInventory(Meteor.user(), itemsToAdd);

  // clear entity's inventory
  Entities.update(entity._id, { $set: { inventory: {} } });
};

Meteor.methods({
  useEntity(entityId, value = undefined) {
    check(entityId, String);

    const entity = Entities.findOne(entityId);
    if (!entity) throw new Meteor.Error(404, 'Entity not found.');

    if (!entity.actionType || entity.actionType === entityActionType.actionable) switchEntityState(entity, value);
    else if (entity.actionType === entityActionType.pickable) {
      pickEntityInventory(entity, value);
      Entities.remove(entity._id);
    } else throw new Error('entity action not implemented');

    return entity;
  },
  subscribedUsers(entityId) { return subscribedUsersToEntity(entityId); },
});

Meteor.publish('entities', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Entities.find({ levelId });
});
