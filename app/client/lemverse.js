const Phaser = require('phaser');

scopes = {
  player: 'player',
  editor: 'editor',
};

hotkeys.filter = function (event) {
  const { tagName } = event.target || event.srcElement;
  return !/^(INPUT|TEXTAREA)$/.test(tagName);
};

Template.registerHelper('tileLayer', function () { return tileLayer(this); });
Template.registerHelper('worldToTileX', x => game?.scene.keys.WorldScene.map.worldToTileX(x));
Template.registerHelper('worldToTileY', y => game?.scene.keys.WorldScene.map.worldToTileY(y));

game = undefined;

isModalOpen = () => Session.get('displaySettings') || Session.get('displayZoneId') || Session.get('displayNotificationsPanel');

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth / Meteor.settings.public.zoom,
  height: window.innerHeight / Meteor.settings.public.zoom,
  zoom: Meteor.settings.public.zoom,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: Meteor.settings.public.debug,
      gravity: { y: 0 },
    },
  },
  dom: {
    createContainer: true,
  },
};

Template.lemverse.onCreated(function () {
  Session.set('selectedTiles', undefined);
  Session.set('selectedTilesetId', undefined);
  Session.set('gameCreated', false);
  Session.set('loading', true);
  Session.set('tilesetsLoaded', false);
  Session.set('editor', 0);
  Session.set('displaySettings', false);
  Session.set('displayUserList', false);
  Session.set('displayNotification', false);
  Session.set('displayNotificationsPanel', false);
  Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });

  document.addEventListener('keydown', event => {
    if (event.code !== 'Escape') return;
    Session.set('displaySettings', false);
    Session.set('displayZoneId', false);
    Session.set('displayNotificationsPanel', false);
    Session.set('displayUserList', false);
    game.scene.keys.WorldScene.enableKeyboard(true, true);
    document.activeElement.blur();
  });

  this.subscribe('characters');
  this.subscribe('levels');
  this.subscribe('notifications');
  this.subscribe('tilesets', () => {
    log('All tilesets loaded');
    Session.set('selectedTilesetId', undefined);
    Session.set('tilesetsLoaded', true);
  });

  this.autorun(() => {
    if (game || !Session.get('tilesetsLoaded')) return;
    game = new Phaser.Game(config);
    game.scene.add('BootScene', BootScene, true);
  });

  this.autorun(() => {
    if (!game) return;

    const modalOpen = isModalOpen();
    Tracker.nonreactive(() => {
      const worldScene = game.scene.getScene('WorldScene');
      worldScene.enableKeyboard(!modalOpen, !modalOpen);
      userManager.pauseAnimation(undefined, modalOpen);
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareAudio': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else userStreams.createStream().then(() => userStreams.audio(user.profile.shareAudio, true));
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareVideo': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else userStreams.createStream().then(() => userStreams.video(user.profile.shareVideo, true));
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareScreen': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (user.profile.shareScreen) userStreams.createScreenStream().then(() => userStreams.screen(true, true));
      else userStreams.screen(false);
    });
  });

  this.autorun(() => {
    if (!Session.get('gameCreated')) return;
    game.scene.getScene('EditorScene')?.updateEditionMarker(Session.get('selectedTiles'));
  });

  this.autorun(() => {
    if (!Session.get('gameCreated')) return;

    const worldScene = game.scene.getScene('WorldScene');
    Tracker.nonreactive(() => {
      if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
      if (!this.handleObserveTilesets) {
        this.handleObserveTilesets = Tilesets.find().observe({
          added(tileset) {
            game.scene.keys.BootScene.loadTilesetsAtRuntime([tileset], worldScene.addTilesetsToLayers);
          },
          changed(o, n) {
            const oTileKeys = _.map(_.keys(o.tiles || {}), k => +k);
            const nTileKeys = _.map(_.keys(n.tiles || {}), k => +k);
            const d1 = _.difference(oTileKeys, nTileKeys);
            const d2 = _.difference(nTileKeys, oTileKeys);
            const d3 = _.filter(oTileKeys, index => o.tiles[index]?.layer !== n.tiles[index]?.layer);
            const changedTileIndexes = _.union(d1, d2, d3);
            const xys = _.map(Tiles.find({ tilesetId: n._id, index: { $in: changedTileIndexes } }).fetch(), t => ({ x: t.x, y: t.y }));
            _.forEach(xys, xy => worldScene.tileRefresh(xy.x, xy.y));

            const enabledCollisionIndexes = _.difference(o.collisionTileIndexes, n.collisionTileIndexes);
            const disabledCollisionIndexes = _.difference(n.collisionTileIndexes, o.collisionTileIndexes);

            const enabledCollisionGlobalIndexes = _.map(enabledCollisionIndexes, i => tileGlobalIndex({ index: i, tilesetId: n._id }));
            const disabledCollisionGlobalIndexes = _.map(disabledCollisionIndexes, i => tileGlobalIndex({ index: i, tilesetId: n._id }));

            const { layers } = worldScene.map;
            _.each(layers, layer => {
              worldScene.map.setCollision(enabledCollisionGlobalIndexes, true, false, layer.tilemapLayer);
              worldScene.map.setCollision(disabledCollisionGlobalIndexes, false, false, layer.tilemapLayer);
            });
          },
        });
      }

      if (this.handleObserveCharacters) this.handleObserveCharacters.stop();
      if (!this.handleObserveCharacters) {
        this.handleObserveCharacters = Characters.find().observe({
          added(character) {
            game.scene.keys.BootScene.loadCharactersAtRuntime([character]);
          },
          changed(character, previous) {
            if (!character.category) return;

            const { anims } = game.scene.keys.WorldScene;
            const animExist = (sprite, orientation) => anims[`${sprite._id}${sprite.category}${orientation}`];

            // Remove previous animation
            ['up', 'down', 'left', 'right'].forEach(orientation => {
              if (animExist(previous, orientation)) {
                anims.remove(`${previous._id}${previous.category}${orientation}`);
              }
            });

            if (!animExist(character, 'right')) {
              anims.create({
                key: `${character._id}right`,
                frames: anims.generateFrameNumbers(character._id, { frames: [48, 49, 50, 51, 52, 53] }),
                frameRate: 10,
                repeat: -1,
              });
            }
            if (!animExist(character, 'up')) {
              anims.create({
                key: `${character._id}up`,
                frames: anims.generateFrameNumbers(character._id, { frames: [54, 55, 56, 57, 58, 59] }),
                frameRate: 10,
                repeat: -1,
              });
            }
            if (!animExist(character, 'left')) {
              anims.create({
                key: `${character._id}left`,
                frames: anims.generateFrameNumbers(character._id, { frames: [60, 61, 62, 63, 64, 65] }),
                frameRate: 10,
                repeat: -1,
              });
            }
            if (!animExist(character, 'down')) {
              anims.create({
                key: `${character._id}down`,
                frames: anims.generateFrameNumbers(character._id, { frames: [66, 67, 68, 69, 70, 71] }),
                frameRate: 10,
                repeat: -1,
              });
            }
          },
        });
      }
    });
  });

  this.autorun(() => {
    if (!Session.get('gameCreated')) return;

    const levelId = Meteor.user({ fields: { 'profile.levelId': 1 } }).profile?.levelId;
    Tracker.nonreactive(() => {
      log(`loading level: ${levelId || 'unknown'}…`);
      if (this.handleTilesSubscribe) this.handleTilesSubscribe.stop();
      if (this.handleUsersSubscribe) this.handleUsersSubscribe.stop();
      if (this.handleZonesSubscribe) this.handleZonesSubscribe.stop();
      if (this.handleObserveTiles) this.handleObserveTiles.stop();
      if (this.handleObserveUsers) this.handleObserveUsers.stop();
      if (this.handleObserveZones) this.handleObserveZones.stop();
      const worldScene = game.scene.getScene('WorldScene');

      // Load users
      log(`loading level: loading users`);
      this.handleUsersSubscribe = this.subscribe('users', levelId, () => {
        this.handleObserveUsers = Meteor.users.find({ status: { $exists: true } }).observe({
          added(user) {
            userManager.create(user);
          },
          changed(user, oldUser) {
            userManager.update(user, oldUser);
          },
          removed(user) {
            userManager.remove(user);
            userProximitySensor.removeNearUser(user);
            lp.defer(() => peer.close(user._id, 0, 'user-disconnected'));
          },
        });

        log('loading level: all users loaded');
        if (!Meteor.user()?.profile.guest) peer.createMyPeer();
      });

      // Load zones
      log(`loading level: loading zones`);
      this.handleZonesSubscribe = this.subscribe('zones', levelId, () => {
        this.handleObserveZones = Zones.find().observe({
          added(zone) {
            if (zone.popInConfiguration?.autoOpen) characterPopIns.initFromZone(zone);
          },
          changed(zone) {
            const currentZone = zones.currentZone(Meteor.user());
            if (!currentZone || currentZone._id !== zone._id) return;

            if (meet.api) meet.fullscreen(zone.fullscreen);
          },
        });

        log('loading level: all zones loaded');
        zones.checkDistances(userManager.player);
      });

      // Load tiles
      log(`loading level: loading tiles`);
      this.handleTilesSubscribe = this.subscribe('tiles', levelId, () => {
        this.handleObserveTiles = Tiles.find().observe({
          added(tile) {
            const layer = tileLayer(tile);
            worldScene.map.putTileAt(tileGlobalIndex(tile), tile.x, tile.y, false, layer);
            worldScene.drawTeleporters(false);
          },
          changed(tile) {
            const layer = tileLayer(tile);
            worldScene.map.putTileAt(tileGlobalIndex(tile), tile.x, tile.y, false, layer);
          },
          removed(tile) {
            const layer = tileLayer(tile);
            worldScene.map.removeTileAt(tile.x, tile.y, false, false, layer);
          },
        });

        log('loading level: all tiles loaded');
        worldScene.onLevelLoaded();
      });

      game.scene.getScene('EditorScene')?.init();
    });
  });

  hotkeys('e', { scope: 'all' }, event => {
    if (event.repeat || !isEditionAllowed(Meteor.userId())) return;
    Session.set('editor', !Session.get('editor'));
  });

  hotkeys('l', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    const user = Meteor.user();
    if (!user) return;

    Meteor.users.update(Meteor.userId(), { [event.type === 'keydown' ? '$set' : '$unset']: { 'profile.reaction': user.profile.defaultReaction || Meteor.settings.public.defaultReaction } });
  });

  hotkeys('f', { scope: scopes.player }, event => {
    if (event.repeat || !meet.api) return;
    event.preventDefault();

    const user = Meteor.user();
    if (!user.roles?.admin) return;

    const currentZone = zones.currentZone(user);
    if (currentZone) zones.setFullscreen(currentZone, !currentZone.fullscreen);
  });

  hotkeys('j', { scope: scopes.player }, event => {
    event.preventDefault();
    if (event.repeat) return;

    if (meet.api) meet.close(); else meet.open();
  });

  const recordVoice = (event, callback) => {
    userVoiceRecorderAbility.onSoundRecorded = callback;

    if (event.type === 'keydown' && !userVoiceRecorderAbility.isRecording()) {
      userStreams.audio(false);
      userVoiceRecorderAbility.start();
    } else if (event.type === 'keyup') {
      userStreams.audio(Meteor.user()?.profile.shareAudio);
      userVoiceRecorderAbility.stop();
    }
  };

  hotkeys('r', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    recordVoice(event, chunks => {
      const user = Meteor.user();
      const usersInZone = zones.usersInZone(zones.currentZone(user));
      peer.sendData(usersInZone, { type: 'audio', emitter: user._id, data: chunks }).then(() => {
        lp.notif.success(`📣 Everyone has heard your powerful voice`);
      }).catch(() => lp.notif.warning('❌ No one is there to hear you'));
    });
  });

  hotkeys('p', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    const user = Meteor.user();
    if (!user.roles?.admin) return;
    if (!userProximitySensor.nearUsersCount() && event.type === 'keydown') { lp.notif.error(`You need someone near you to whisper`); return; }

    recordVoice(event, chunks => {
      const { nearUsers } = userProximitySensor;
      let targets = [...new Set(_.keys(nearUsers))];
      targets = targets.filter(target => target !== Meteor.userId());
      if (!targets.length) { lp.notif.error(`You need someone near you to whisper`); return; }

      lp.notif.success('✉️ Your voice message has been sent!');

      // Upload
      const blob = userVoiceRecorderAbility.generateBlob(chunks);
      const file = new File([blob], `audio-record.${userVoiceRecorderAbility.getExtension()}`, { type: blob.type });
      const uploadInstance = Files.insert({
        file,
        chunkSize: 'dynamic',
        meta: { source: 'voice-recorder', targets },
      }, false);

      uploadInstance.on('end', error => {
        if (error) lp.notif.error(`Error during upload: ${error.reason}`);
      });

      uploadInstance.start();
    });
  });

  hotkeys('tab', event => {
    if (event.repeat) return;
    event.preventDefault();

    Session.set('displayUserList', !Session.get('displayUserList'));
  });

  hotkeys('shift+1', { scope: scopes.player }, () => {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareAudio': !Meteor.user().profile.shareAudio } });
  });

  hotkeys('shift+2', { scope: scopes.player }, () => {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareVideo': !Meteor.user().profile.shareVideo } });
  });

  hotkeys('shift+3', { scope: scopes.player }, () => {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': !Meteor.user().profile.shareScreen } });
  });

  hotkeys('shift+4', { scope: scopes.player }, () => {
    if (!Session.get('displaySettings')) settings.enumerateDevices();
    Session.set('displaySettings', !Session.get('displaySettings'));
  });

  hotkeys('shift+5', { scope: scopes.player }, () => {
    Session.set('displayNotificationsPanel', !Session.get('displayNotificationsPanel'));
  });

  hotkeys('shift+0', { scope: scopes.player }, () => {
    game.scene.keys.WorldScene.drawTeleporters(!game?.scene.keys.WorldScene.teleporterGraphics.length);
  });
});

Template.lemverse.onRendered(function () {
  this.autorun(() => {
    if (!Session.get('gameCreated')) return;

    if (!this.resizeObserver) {
      const resizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
          config.width = entry.contentRect.width / Meteor.settings.public.zoom;
          config.height = entry.contentRect.height / Meteor.settings.public.zoom;
          game.scale.resize(config.width, config.height);
        });
      });
      const simulation = document.querySelector('.simulation');
      if (simulation) {
        this.resizeObserver = true;
        resizeObserver.observe(simulation);
      }
    }
  });
});

Template.lemverse.onDestroyed(function () {
  if (this.handleObserveUsers) this.handleObserveUsers.stop();
  if (this.handleObserveTiles) this.handleObserveTiles.stop();
  if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
  if (this.handleObserveZones) this.handleObserveZones.stop();
  if (this.handleTilesSubscribe) this.handleTilesSubscribe.stop();
  if (this.handleUsersSubscribe) this.handleUsersSubscribe.stop();
  if (this.handleZonesSubscribe) this.handleZonesSubscribe.stop();
  if (this.resizeObserver) this.resizeObserver.disconnect();

  hotkeys.unbind('e', scopes.player);
  hotkeys.unbind('f', scopes.player);
  hotkeys.unbind('j', scopes.player);
  hotkeys.unbind('l', scopes.player);
  hotkeys.unbind('r', scopes.player);
  hotkeys.unbind('tab', scopes.player);
  hotkeys.unbind('shift+1', scopes.player);
  hotkeys.unbind('shift+2', scopes.player);
  hotkeys.unbind('shift+3', scopes.player);
  hotkeys.unbind('shift+4', scopes.player);
});

Template.lemverse.helpers({
  allRemoteStreamsByUsers: () => peer.remoteStreamsByUsers.get(),
  isLoading: () => Session.get('loading'),
  isGuest: () => Meteor.user()?.profile.guest,
  hasNotifications: () => Notifications.find().count(),
  pendingNotificationsCount: () => Notifications.find({ read: false }).count(),
});

Template.lemverse.events({
  'click .button.audio'() {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareAudio': !Meteor.user().profile.shareAudio } });
  },
  'click .button.video'() {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareVideo': !Meteor.user().profile.shareVideo } });
  },
  'click .button.screen'() {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': !Meteor.user().profile.shareScreen } });
  },
  'click .button.settings'() {
    if (!Session.get('displaySettings')) settings.enumerateDevices();
    Session.set('displaySettings', !Session.get('displaySettings'));
  },
  'click .button.js-notifications'() {
    Session.set('displayNotificationsPanel', !Session.get('displayNotificationsPanel'));
  },
});
