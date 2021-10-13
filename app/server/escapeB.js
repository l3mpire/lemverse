Meteor.methods({
  escapeMakeLevel(templateId, zone, usersInZone) {
    log('escapeMakeLevel: start', { templateId, zoneId: zone._id, usersInZoneId: usersInZone?.map(user => user._id) });
    const { escape } = zone;

    if (!escape?.triggerLimit || !templateId || !usersInZone) return;

    // Clone Level
    log('escapeMakeLevel: cloning template', { templateId });
    const newLevelId = createLevel(templateId, `Escape B #${Math.floor(Math.random() * 100)}`);

    // Teleport user
    const usersToTeleport = usersInZone.slice(-1).concat(usersInZone.slice(0, escape.triggerLimit - 1));
    log('escapeMakeLevel: teleport users', { usersToTeleport: usersToTeleport.map(user => user._id), newLevelId });
    Meteor.users.update({ _id: { $in: usersToTeleport.map(user => user._id) } }, { $set: { 'profile.changeLevel': newLevelId } }, { multi: true });
    log('escapeMakeLevel: end');
  },
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
  teleportAllTo(name, position) {
    log('teleportAllTo: start', { position });
    const currentLevel = Levels.findOne({ _id: Meteor.user().profile.levelId });
    const allPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true }).fetch();

    if (!currentLevel.metadata.teleport[name]) {
      Levels.update({ _id: currentLevel._id }, { $set: { [`metadata.teleport.${name}`]: true } });

      log('teleportAllTo: teleport', { level: currentLevel.name || currentLevel._id, allPlayers: allPlayers.length });
      Meteor.users.update({ _id: { $in: allPlayers.map(player => player._id) } }, { $set: { 'profile.x': position.x, 'profile.y': position.y }, $unset: { 'profile.freeze': 1 } }, { multi: true });
    }
  },
  updateTiles(tiles) {
    log('updateTiles: start', { tiles: tiles.length });
    if (!tiles) return;
    tiles.forEach(tile => {
      if (!tile.id || !tile.update) return;
      log('updateTiles: Updating tile', { tile });
      Tiles.update({ _id: tile.id }, { $set: tile.update });
    });
  },
  freezeOthers() {
    log('freezeOthers: start');
    const currentLevel = Levels.findOne({ _id: Meteor.user().profile.levelId });
    const allOtherPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true, _id: { $ne: Meteor.userId() } }).fetch();

    log('freezeOthers: freezing', { allOtherPlayers: allOtherPlayers.length, levelId: currentLevel._id });
    Meteor.users.update({ _id: { $in: allOtherPlayers.map(player => player._id) } }, { $set: { 'profile.freeze': true } }, { multi: true });
  },
});
