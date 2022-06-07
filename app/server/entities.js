const applyEntityState = (entity, stateActions) => {
  const { levelId } = entity;

  stateActions.remove?.forEach(t => Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index }));

  stateActions.add?.forEach(t => Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() }));

  stateActions.replace?.forEach(t => Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } }));
};

spawnEntityFromPrefab = (entityId, options = {}) => {
  check(entityId, String);
  check(options, { x: Number, y: Number, levelId: String });

  log('spawnEntityFromPrefab: start', { entityId, options });

  const entityPrefab = Entities.findOne(entityId);
  if (!entityPrefab) throw new Error(`The entity does not exists (${entityId})`);

  const spawnedEntityId = Entities.insert({
    ...entityPrefab,
    _id: Entities.id(),
    levelId: options.levelId,
    x: options.x,
    y: options.y,
    createdBy: Meteor.userId(),
    createdAt: new Date(),
    prefab: undefined, // remove prefab attribute
  });

  log('spawnEntityFromPrefab: done', { spawnedEntityId });

  return spawnedEntityId;
};

const spawnEntityFromFile = (fileId, options = {}) => {
  log('spawnEntityFromFile: start', { fileId, options });
  check(fileId, String);
  check(options, { x: Number, y: Number, levelId: String });

  const spawnedEntityId = Entities.insert({
    _id: Entities.id(),
    levelId: options.levelId,
    x: options.x,
    y: options.y,
    actionType: entityActionType.none,
    gameObject: {
      sprite: {
        key: fileId,
        fileId,
      },
    },
    createdBy: Meteor.userId(),
    createdAt: new Date(),
  });

  log('spawnEntityFromFile: done', { spawnedEntityId });

  return spawnedEntityId;
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
  else stateActions = entity.states[newState];

  if (!stateActions) {
    log('Invalid state', { entity, newState });
    return;
  }

  applyEntityState(entity, stateActions);
  Entities.update(entity._id, { $set: { state: newState } });

  log('switchEntityState: done', { entity, newState });
};

const pickEntityInventory = entity => {
  log('pickEntityInventory: start', { entity });
  const inventoryItemKeys = Object.keys(entity.inventory || {});
  if (!inventoryItemKeys.length) throw new Error(`entity's inventory is empty`);

  // adds the entity's items to the user's inventory
  const itemsToAdd = inventoryItemKeys.map(key => ({ itemId: key, amount: entity.inventory[key] }));
  if (addToInventory) addToInventory(Meteor.user(), itemsToAdd);

  // clear entity's inventory
  Entities.update(entity._id, { $set: { inventory: {} } });
};

Meteor.methods({
  useEntity(entityId, value = undefined) {
    check(value, Match.OneOf(undefined, null, Number, String));
    check(entityId, String);

    const entity = Entities.findOne(entityId);
    if (!entity) throw new Meteor.Error(404, 'Entity not found.');

    if (!entity.actionType || entity.actionType === entityActionType.actionable) switchEntityState(entity, value);
    else if (entity.actionType === entityActionType.pickable) {
      pickEntityInventory(entity);
      Entities.remove(entity._id);
    } else throw new Error('entity action not implemented');

    return entity;
  },
  subscribedUsers(entityId) {
    check(entityId, String);

    return subscribedUsersToEntity(entityId);
  },
  spawnEntityFromFile(fileId, options = {}) {
    check(fileId, String);
    check(options, { x: Match.Optional(Number), y: Match.Optional(Number) });
    if (!lp.isLemverseBeta('custom-sprite')) throw new Meteor.Error('invalid-user', 'available for admin only for now');
    if (!this.userId) return undefined;

    const { levelId, x, y } = Meteor.user().profile;

    return spawnEntityFromFile(fileId, {
      x: options.x || x,
      y: options.y || y,
      levelId,
    });
  },
  spawnEntityFromPrefab(entityId, options = {}) {
    check(entityId, String);
    check(options, { x: Match.Optional(Number), y: Match.Optional(Number) });
    if (!this.userId) return undefined;

    const { levelId, x, y } = Meteor.user().profile;

    return spawnEntityFromPrefab(entityId, {
      levelId: options.levelId || levelId,
      x: options.x || x,
      y: options.y || y,
    });
  },
});

Meteor.publish('entities', function (levelId) {
  check(levelId, Match.Maybe(String));
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Entities.find({ levelId, prefab: { $exists: false } });
});

Meteor.publish('entityPrefabs', function (levelId) {
  check(levelId, Match.Maybe(String));
  if (!this.userId) return undefined;

  const selectors = { prefab: true };

  if (!Meteor.user().roles?.admin) selectors.validated = { $exists: true };
  if (levelId) selectors.$or = [{ levelId: { $exists: false } }, { levelId }];

  return Entities.find(selectors);
});
