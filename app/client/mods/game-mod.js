import DizzyEffect from '../../public/assets/post-effects/DizzyEffect';

const differMeteorCall = (...args) => setTimeout(() => { Meteor.call(...args); }, 0);

const onZoneEntered = e => {
  const { levelId: currentLevelId } = Meteor.user().profile;
  const { zone } = e.detail;
  const { escape } = zone;
  const { WorldScene, UIScene } = game.scene.keys;

  if (!escape) return;

  if (escape.triggerLimit) {
    const users = zones.usersInZone(zone, true);
    if (users.length >= escape.triggerLimit) {
      if (escape.makeLevel) differMeteorCall('escapeMakeLevel', escape.makeLevel, zone, users);
    }
  }

  if (escape.setCurrentLevel) {
    Meteor.call('currentLevel', (err, result) => {
      if (err) return;
      Session.set('currentLevel', result);
    });
  }
  if (escape.start && zones.usersInZone(zone, true).length === Meteor.users.find().count()) differMeteorCall('escapeStart', escape.startZone, currentLevelId);
  if (escape.enlightenZone) differMeteorCall('enlightenZone', escape.enlightenZone);
  if (escape.teleportAllTo) differMeteorCall('teleportAllTo', escape.teleportAllTo.name, escape.teleportAllTo.coord);
  if (escape.updateTiles) differMeteorCall('updateTiles', escape.updateTiles);
  if (escape.freezeOthers) differMeteorCall('freezeOthers');
  if (escape.end) {
    differMeteorCall('escapeEnd', currentLevelId, escape.winZoneName, escape.lostZoneName, () => {
      Meteor.call('currentLevel', (err, result) => {
        if (err) return;
        Session.set('currentLevel', result);
      });
    });
  }
  if (escape.setCurrentRoom) differMeteorCall('setCurrentRoom', escape.setCurrentRoom);
  if (escape.hurtPlayer) {
    userManager.flashColor(userManager.player, 0xFF0000);
    setTimeout(() => {
      const { x, y } = escape.hurtPlayer.teleportPosition;
      userManager.teleportMainUser(+x, +y);
    }, 0);
  }

  if (escape.team) {
    const zoneA = Zones.findOne({ 'escape.team': 'A' });
    const zoneB = Zones.findOne({ 'escape.team': 'B' });
    const usersCountZoneA = zones.usersInZone(zoneA, true).length;
    const usersCountZoneB = zones.usersInZone(zoneB, true).length;

    if (usersCountZoneA > 0 && usersCountZoneB > 0 && usersCountZoneA === usersCountZoneB) differMeteorCall('switchEntityState', currentLevelId, 'door-room-2');
  } else if (escape.switchEntityState) differMeteorCall('switchEntityState', currentLevelId, escape.switchEntityState);
  else if (escape.waitEveryoneZone) {
    if (zones.usersInZone(zone, true).length === Meteor.users.find().count()) {
      differMeteorCall('switchEntityState', currentLevelId, 'room-4-ready', escape.forceEntityState);
    }
  }

  if (escape.paintTiles) escapeA.enable_sync_coloration = true;
  else if (escape.enableDistortionEffect) {
    game.renderer.pipelines.addPostPipeline('DizzyEffect', DizzyEffect);
    WorldScene.cameras.main.setPostPipeline(DizzyEffect);
    UIScene.cameras.main.setPostPipeline(DizzyEffect);
    escapeA.enable_path_coloration = true;
  }
};

const onZoneLeaved = e => {
  const { zone } = e.detail;

  if (!zone.popInConfiguration?.autoOpen) characterPopIns.destroyPopIn(`${Meteor.userId()}-${zone._id}`);

  game.scene.keys.WorldScene.cameras.main.resetPostPipeline();
  game.scene.keys.UIScene.cameras.main.resetPostPipeline();
  escapeA.enable_path_coloration = false;
  escapeA.enable_sync_coloration = false;
};

const paintTile = (worldScene, tile, layer) => {
  const phaserTile = levelManager.map.getTileAt(tile.x, tile.y, false, layer);
  const converted = stringToColor(tile.metadata.paint).replace('#', '0x');
  const color = parseInt(converted, 16) * 100;
  if (phaserTile) phaserTile.tint = color;
};

const onTileAdded = e => {
  const { tile, layer } = e.detail;
  if (!tile.metadata) return;

  const { WorldScene } = game.scene.keys;
  if (tile.metadata.escapeHint) chest();
  else if (tile.metadata.paint) paintTile(WorldScene, tile, layer);
};

const onTileChanged = e => {
  const { tile, layer } = e.detail;
  if (!tile.metadata) return;

  const { WorldScene } = game.scene.keys;
  if (tile.metadata.paint) paintTile(WorldScene, tile, layer);
};

const onEntityUpdated = e => {
  const { entity } = e.detail;
  escapeA.update(entity);
};

Template.gameMod.onCreated(() => {
  window.addEventListener('onZoneEntered', onZoneEntered);
  window.addEventListener('onZoneLeaved', onZoneLeaved);
  window.addEventListener('onTileAdded', onTileAdded);
  window.addEventListener('onTileChanged', onTileChanged);
  window.addEventListener('onEntityUpdated', onEntityUpdated);
});

Template.gameMod.onDestroyed(() => {
  window.removeEventListener('onZoneEntered', onZoneEntered);
  window.removeEventListener('onZoneLeaved', onZoneLeaved);
  window.removeEventListener('onTileAdded', onTileAdded);
  window.removeEventListener('onTileChanged', onTileChanged);
  window.removeEventListener('onEntityUpdated', onEntityUpdated);
});

Template.gameMod.helpers({
  displayEscapeTimer: () => {
    const level = Session.get('currentLevel');
    if (!level) return false;
    return FlowRouter.current()?.path === '/' && level.metadata?.escape && level.metadata?.start && !level.metadata?.end;
  },
});
