escapeTransport = {};

Meteor.methods({
  escapeMakeLevel(templateId, zone, usersInZone) {
    log('escapeMakeLevel: start', { templateId, zoneId: zone._id, usersInZoneId: usersInZone?.map(user => user._id) });
    check(templateId, String);
    check(zone, Object);
    check(usersInZone, [String]);

    const { escape } = zone;

    if (!escape?.triggerLimit || !templateId || !usersInZone) return;
    // Check Transport in progress
    if (escapeTransport[templateId]?.length) return;
    const usersToTeleport = usersInZone.slice(-1).concat(usersInZone.slice(0, escape.triggerLimit - 1));
    escapeTransport[templateId] = usersToTeleport;

    // Clone Level
    log('escapeMakeLevel: cloning template', { templateId });
    const newLevelId = createLevel({ templateId, name: `Escape B #${Math.floor(Math.random() * 100)}` });

    // Reset metadata
    Levels.update({ _id: newLevelId }, { $set: { 'metadata.escape': true, 'metadata.teleport': {}, disableEdit: true, godMode: false }, $unset: { 'metadata.end': 1, 'metadata.start': 1, 'metadata.currentRoom': 1, 'metadata.currentRoomTime': 1 } });

    // Teleport user
    log('escapeMakeLevel: teleport users', { usersToTeleport: usersToTeleport.map(user => user._id), newLevelId });
    usersToTeleport.map(user => user._id).forEach(userId => teleportUserInLevel(newLevelId, userId));

    // Free the transport rings!
    escapeTransport[templateId] = [];
    log('escapeMakeLevel: end');
  },
  enlightenZone(name) {
    log('enlightenZone: start', { name });
    check(name, String);

    const allTiles = Tiles.find({ 'metadata.zoneName': name, levelId: Meteor.user().profile.levelId }).fetch();
    if (!allTiles) return;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible: true } }, { multi: true });
    log('enlightenZone: updating', { nbTiles: allTiles.length });
  },
  darkenZone(name) {
    log('darkenZone: start', { name });
    check(name, String);

    const allTiles = Tiles.find({ 'metadata.zoneName': name, levelId: Meteor.user().profile.levelId }).fetch();
    if (!allTiles) return;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible: false } }, { multi: true });
    log('enlightenZone: updating', { nbTiles: allTiles.length });
  },
  toggleZone(name) {
    log('toggleZone: start', { name });
    check(name, String);

    const allTiles = Tiles.find({ 'metadata.zoneName': name, levelId: Meteor.user().profile.levelId }).fetch();
    if (!allTiles || !allTiles.length) return;
    const invisible = !allTiles[0].invisible;
    Tiles.update({ _id: { $in: allTiles.map(tile => tile._id) } }, { $set: { invisible } }, { multi: true });
    log('toggleZone: updating', { nbTiles: allTiles.length });
  },
  escapeStart(zoneName, levelId) {
    log('escapeStart: start', { zoneName, levelId });
    check([zoneName, levelId], [String]);

    const currentLevel = Levels.findOne({ _id: levelId });

    if (!currentLevel.metadata.start) {
      // Start time
      Levels.update({ _id: levelId }, { $set: { 'metadata.start': Date.now() } });
      // Open locked door
      Tiles.update({ levelId, 'metadata.zoneName': zoneName }, { $set: { invisible: true } }, { multi: true });
    }
  },
  escapeEnd(levelId, winZoneName, lostZoneName) {
    log('escapeEnd: start', { levelId, winZoneName, lostZoneName });
    check([winZoneName, lostZoneName, levelId], [String]);

    const currentLevel = Levels.findOne({ _id: levelId });

    if (!currentLevel.metadata.end) {
      const endTime = Date.now();
      Levels.update({ _id: levelId }, { $set: { 'metadata.end': endTime } });
      let zoneName = lostZoneName;
      const escapeDurationMinutes = ((endTime - currentLevel.metadata.start) / 60000) | 0;
      if (escapeDurationMinutes < currentLevel.metadata.durationMinutes) {
        // Win
        zoneName = winZoneName;
      }
      Tiles.update({ levelId, 'metadata.zoneName': zoneName }, { $set: { invisible: false } }, { multi: true });
    }
  },
  setCurrentRoom(room) {
    check(room, String);

    const { levelId } = Meteor.user().profile;
    log('setCurrentRoom: start', { levelId });

    const currentLevel = Levels.findOne({ _id: levelId });
    if (!currentLevel.metadata.currentRoom || currentLevel.metadata.currentRoom !== room) {
      Levels.update({ _id: levelId }, { $set: { 'metadata.currentRoom': room, 'metadata.currentRoomTime': Date.now() } });
    }
  },
  currentLevel() {
    return Levels.findOne({ _id: Meteor.user().profile.levelId });
  },
  teleportAllTo(name, position) {
    log('teleportAllTo: start', { position });
    check(name, String);
    check(position, [Number]);

    const currentLevel = Levels.findOne(Meteor.user().profile.levelId);
    const allPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true }).fetch();

    if (!currentLevel.metadata.teleport[name]) {
      Levels.update({ _id: currentLevel._id }, { $set: { [`metadata.teleport.${name}`]: true } });

      log('teleportAllTo: teleport', { level: currentLevel.name || currentLevel._id, allPlayers: allPlayers.length });
      Meteor.users.update({ _id: { $in: allPlayers.map(player => player._id) } }, { $set: { 'profile.x': position.x, 'profile.y': position.y }, $unset: { 'profile.freeze': 1 } }, { multi: true });
    }
  },
  updateTiles(tiles) {
    log('updateTiles: start', { tiles: tiles.length });
    check(tiles, [Object]);

    if (!tiles) return;
    tiles.forEach(tile => {
      if (!tile.metaName || !tile.update) return;
      log('updateTiles: Updating tile', { tile });
      Tiles.update({ 'metadata.name': tile.metaName, levelId: Meteor.user().profile.levelId }, { $set: tile.update }, { multi: true });
    });
  },
  freezeOthers() {
    log('freezeOthers: start');
    const currentLevel = Levels.findOne(Meteor.user().profile.levelId);
    const allOtherPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true, _id: { $ne: Meteor.userId() } }).fetch();

    log('freezeOthers: freezing', { allOtherPlayers: allOtherPlayers.length, levelId: currentLevel._id });
    Meteor.users.update({ _id: { $in: allOtherPlayers.map(player => player._id) } }, { $set: { 'profile.freeze': true } }, { multi: true });

    // Check to everybody froze
    const allPlayers = Meteor.users.find({ 'profile.levelId': currentLevel._id, 'status.online': true }).fetch();
    let allFrozen = true;
    allPlayers.forEach(player => {
      if (!player.profile.freeze) allFrozen = false;
    });

    if (allFrozen) {
      // Un freeze current user
      Meteor.users.update({ _id: Meteor.userId() }, { $unset: { 'profile.freeze': 1 } });
    }
  },
});

// -----------------------------------------------------------------------------------------
// CRON
// -----------------------------------------------------------------------------------------
lp.deferCron('escape', () => {
  log('escape: start');
  const allEscapes = Levels.find({ 'metadata.escape': true }).fetch();

  allEscapes.forEach(level => {
    const { currentRoom, currentRoomTime, hints } = level.metadata;

    const minSinceEntry = (Date.now() - currentRoomTime) / (1000 * 60) | 0;
    if (hints && hints[currentRoom] && hints[currentRoom][`t${minSinceEntry}`] && !hints[currentRoom][`t${minSinceEntry}`].discovered) {
      log('escape: Discover hints');
      // Execute hints
      hints[currentRoom][`t${minSinceEntry}`].updateTiles.forEach(tile => {
        if (!tile.metaName || !tile.update) return;
        log('escape: Updating tile', { tile });
        Tiles.update({ 'metadata.name': tile.metaName, levelId: level._id }, { $set: tile.update }, { multi: true });
      });
      hints[currentRoom][`t${minSinceEntry}`].discovered = true;
    }
  });
});

lp.deferCron('escapeCleanUp', () => {
  const allEscapes = Levels.find({ 'metadata.escape': true, createdAt: { $lt: new Date(Date.now() - (24 * 60 * 60 * 1000)) } }).fetch();
  log('escapeCleanUp: start', { allEscapes: allEscapes.length });

  allEscapes.forEach(level => {
    // Clean up level after a day.
    deleteLevel(level._id);
  });
});
