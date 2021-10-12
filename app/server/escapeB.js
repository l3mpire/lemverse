Meteor.methods({
  enlightenZone(name) {
    log('enlightenZone: start', { name });
    const allTiles = Tiles.find({ 'metadata.zoneName': name }).fetch();
    if (!allTiles) return;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible: true } }, { multi: true });
    log('enlightenZone: updating', { nbTiles: allTiles.length });
  },
  darkenZone(name) {
    log('darkenZone: start', { name });
    const allTiles = Tiles.find({ 'metadata.zoneName': name }).fetch();
    if (!allTiles) return;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible: false } }, { multi: true });
    log('enlightenZone: updating', { nbTiles: allTiles.length });
  },
  toggleZone(name) {
    log('toggleZone: start', { name });
    const allTiles = Tiles.find({ 'metadata.zoneName': name }).fetch();
    if (!allTiles || !allTiles.length) return;
    const invisible = !allTiles[0].invisible;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible } }, { multi: true });
    log('toggleZone: updating', { nbTiles: allTiles.length });
  },
  escapeStart(zone, usersInZone, levelId) {
    log('escapeStart: start', { zone, usersInZone: usersInZone.map(user => user._id), levelId });
    // Start time
    Levels.update({ _id: levelId }, { $set: { 'metadata.start': Date.now() } });
    // Open locked door
    Tiles.update({ levelId, 'metadata.zoneName': 'room1' }, { $set: { invisible: true } }, { multi: true });
  },
  currentLevel() {
    log('here');
    log(Levels.findOne({ _id: Meteor.user().profile.levelId }));
    return Levels.findOne({ _id: Meteor.user().profile.levelId });
  },
});
