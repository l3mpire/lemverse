import { canEditActiveLevel, subscribedUsersToEntity } from '../lib/misc';

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
  check(fileId, Match.SafeString);
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
  check(entity._id, Match.Id);
  log('switchEntityState: start', { entity, forcedState });

  if (!entity.states) throw new Error(`Entity without states`);

  const toggledState = entity.state === 'on' ? 'off' : 'on';
  const newState = forcedState !== undefined ? forcedState : toggledState;
  const stateActions = entity.states[newState];

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

const useEntity = (entityId, value = undefined) => {
  check(value, Match.OneOf(undefined, null, Number, String));
  check(entityId, Match.Id);

  log('useEntity: start', { userId: this.userId, entityId, value });

  const entity = Entities.findOne(entityId);
  if (!entity) throw new Meteor.Error(404, 'Entity not found.');

  if (entity.actionType === entityActionType.pickable) {
    pickEntityInventory(entity);
    Entities.remove(entity._id);
  } else if (entity.actionType === entityActionType.actionable) {
    if (entity.entityId) {
      if (entity.entityId === entityId) throw new Error('The entity is linked to itself');
      useEntity(entity.entityId, value);
    }

    if (entity.states) switchEntityState(entity, value);
  } else if (entity.actionType === entityActionType.none && entity.states) switchEntityState(entity, value);
  else throw new Error('entity action not implemented');

  log('useEntity: done', { userId: this.userId, entityId, value });

  return entity;
};

Meteor.methods({
  useEntity(entityId, value = undefined) {
    check(value, Match.OneOf(undefined, null, Number, String));
    check(entityId, Match.Id);
    return useEntity(entityId, value);
  },
  updateEntityTarget(entityId, targetEntityId) {
    check(entityId, Match.Id);
    check(targetEntityId, Match.OneOf(undefined, null, String));

    log('updateEntityTarget: start', { userId: this.userId, entityId, targetEntityId });

    const entity = Entities.findOne(entityId);
    if (!entity) throw new Meteor.Error(404, 'Entity not found.');

    if (!canEditActiveLevel(Meteor.user())) throw new Meteor.Error('permission-error', `You can't edit this level`);

    // unlink the target
    if (!targetEntityId) Entities.update(entityId, { $unset: { entityId: 1 } });
    else {
      check(targetEntityId, Match.Id);
      Entities.update(entityId, { $set: { entityId: targetEntityId } });
    }

    log('updateEntityTarget: done', { userId: this.userId, entityId, targetEntityId });
  },
  subscribedUsers(entityId) {
    check(entityId, Match.Id);

    return subscribedUsersToEntity(entityId);
  },
  spawnEntityFromFile(fileId, options = {}) {
    check(fileId, Match.SafeString);
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
    check(entityId, Match.Id);
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
  check(levelId, Match.Maybe(Match.Id));
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Entities.find({ levelId, prefab: { $exists: false } });
});

Meteor.publish('entityPrefabs', function (levelId) {
  check(levelId, Match.Maybe(Match.Id));
  if (!this.userId) return undefined;

  const selectors = { prefab: true };

  if (!Meteor.user().roles?.admin) selectors.validated = { $exists: true };
  if (levelId) selectors.$or = [{ levelId: { $exists: false } }, { levelId }];

  return Entities.find(selectors);
});
