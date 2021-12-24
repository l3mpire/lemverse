switchEntityState = (levelId, name, forcedState = undefined) => {
  check([levelId, name], [String]);
  const entity = Entities.findOne({ name, levelId });
  if (!entity || !entity.states) return;

  const entityDocument = Entities.findOne({ levelId, name });
  const newState = forcedState !== undefined ? forcedState : !entityDocument.state;
  const state = newState ? entity.states[1] : entity.states[0];

  state.remove?.forEach(t => {
    Tiles.remove({ levelId, x: t.x, y: t.y, index: t.index });
  });

  state.add?.forEach(t => {
    Tiles.insert({ levelId, x: t.x, y: t.y, index: t.index, tilesetId: t.tilesetId, createdAt: new Date(), createdBy: Meteor.userId() });
  });

  state.replace?.forEach(t => {
    Tiles.update({ levelId, x: t.x, y: t.y }, { $set: { tilesetId: t.newTilesetId, index: t.newIndex } });
  });

  Entities.update({ levelId, name }, { $set: { state: newState } });
};

Meteor.methods({
  switchEntityState(levelId, name, forcedState = undefined) {
    switchEntityState(levelId, name, forcedState);
  },
});
