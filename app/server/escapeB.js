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
    return Levels.findOne({ _id: Meteor.user().profile.levelId });
  },
  teleportAllTo(position) {
    log('teleportAllTo: start', { position });
    const currentLevel = Levels.findOne({ _id: Meteor.user().profile.levelId });
    const allPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true }).fetch();

    log('teleportAllTo: teleport', { level: currentLevel.name || currentLevel._id, allPlayers: allPlayers.length });
    Meteor.users.update({ _id: { $in: allPlayers.map(player => player._id) } }, { $set: { 'profile.x': position.x, 'profile.y': position.y } }, { multi: true });
  },
});
