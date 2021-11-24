import hotkeys from 'hotkeys-js';
import DizzyEffect from '../public/assets/post-effects/DizzyEffect';

const Phaser = require('phaser');

scopes = {
  player: 'player',
  editor: 'editor',
};

hotkeys.filter = function (event) {
  const { tagName } = event.target || event.srcElement;
  return !/^(INPUT|TEXTAREA)$/.test(tagName);
};

toggleUserProperty = propertyName => {
  Meteor.users.update(Meteor.userId(), { $set: { [`profile.${propertyName}`]: !Meteor.user().profile[propertyName] } });
};

game = undefined;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth / Meteor.settings.public.zoom,
  height: window.innerHeight / Meteor.settings.public.zoom,
  zoom: Meteor.settings.public.zoom,
  inputWindowEvents: false,
  pixelArt: true,
  roundPixels: true,
  title: Meteor.settings.public.lp.product,
  url: Meteor.settings.public.lp.website,
  physics: {
    default: 'arcade',
    arcade: {
      debug: Meteor.settings.public.debug,
      gravity: { y: 0 },
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800, // Default game window width
    height: 600, // Default game window height,
  },
  dom: {
    createContainer: true,
  },
  pipeline: { DizzyEffect },
};

Template.lemverse.onCreated(function () {
  Session.set('selectedTiles', undefined);
  Session.set('selectedTilesetId', undefined);
  Session.set('sceneWorldReady', false);
  Session.set('loading', true);
  Session.set('tilesetsLoaded', false);
  Session.set('editor', 0);
  Session.set('modal', undefined);
  Session.set('menu', undefined);

  window.addEventListener('dblclick', () => sendEvent('toggle-fullscreen'));
  window.addEventListener('beforeunload', () => Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } }));

  this.hasLevelLoaded = false;
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
    if (!Meteor.userId()) Session.set('sceneWorldReady', false);
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;

    const menuOpen = Session.set('menu');
    const modalOpen = isModalOpen();
    Tracker.nonreactive(() => {
      const interfaceOpen = menuOpen || modalOpen;
      const worldScene = game.scene.getScene('WorldScene');
      userManager.pauseAnimation(undefined, modalOpen);
      worldScene.enableMouse(!interfaceOpen);
      worldScene.enableKeyboard(!modalOpen, !modalOpen);
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareAudio': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else if (!user.profile.shareAudio) userStreams.audio(false);
      else if (user.profile.shareAudio) {
        userStreams.createStream().then(() => {
          userStreams.audio(true);
          userProximitySensor.callProximityStartedForAllNearUsers();
        });
      }
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareVideo': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else if (!user.profile.shareVideo) userStreams.video(false);
      else if (user.profile.shareVideo) {
        const forceNewStream = userStreams.shouldCreateNewStream(streamTypes.main, true, true);
        userStreams.createStream(forceNewStream).then(() => {
          userStreams.video(true);
          userProximitySensor.callProximityStartedForAllNearUsers();
        });
      }
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareScreen': 1 } });
    if (!user) return;
    Tracker.nonreactive(() => {
      if (user.profile.shareScreen) userStreams.createScreenStream().then(() => userStreams.screen(true));
      else userStreams.screen(false);
    });
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;
    game.scene.getScene('EditorScene')?.updateEditionMarker(Session.get('selectedTiles'));
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;

    Tracker.nonreactive(() => {
      if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
      if (!this.handleObserveTilesets) {
        this.handleObserveTilesets = Tilesets.find().observe({
          added(tileset) {
            game.scene.keys.BootScene.loadTilesetsAtRuntime([tileset], levelManager.addTilesetsToLayers.bind(levelManager));
          },
          changed(n, o) {
            levelManager.onTilesetUpdated(n, o);
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
    if (!Session.get('sceneWorldReady')) return;

    const loggedUser = Meteor.user({ fields: { 'profile.levelId': 1 } });
    if (!loggedUser) return;
    const { levelId } = loggedUser.profile;

    Tracker.nonreactive(() => {
      if (this.handleEntitiesSubscribe) this.handleEntitiesSubscribe.stop();
      if (this.handleTilesSubscribe) this.handleTilesSubscribe.stop();
      if (this.handleUsersSubscribe) this.handleUsersSubscribe.stop();
      if (this.handleZonesSubscribe) this.handleZonesSubscribe.stop();
      if (this.handleObserveEntities) this.handleObserveEntities.stop();
      if (this.handleObserveTiles) this.handleObserveTiles.stop();
      if (this.handleObserveUsers) this.handleObserveUsers.stop();
      if (this.handleObserveZones) this.handleObserveZones.stop();

      // world clean-up
      const levelName = Levels.findOne(levelId)?.name;
      const loadingScene = game.scene.getScene('LoadingScene');
      const worldScene = game.scene.getScene('WorldScene');
      loadingScene.setText(levelName);
      loadingScene.show();

      // update title
      const titleParts = [Meteor.settings.public.lp.product];
      if (levelName) titleParts.push(levelName);
      document.title = titleParts.reverse().join(' - ');

      if (this.hasLevelLoaded) {
        log(`unloading current level…`);
        worldScene.scene.restart();
        this.hasLevelLoaded = false;
        return;
      }

      // Load users
      log(`loading level: ${levelId || 'unknown'}…`);
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
        peer.init();
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

            if (meet.api) {
              meet.fullscreen(zone.fullscreen);
              const screenMode = zone.fullscreen ? viewportModes.small : viewportModes.splitScreen;
              worldScene.updateViewport(screenMode);
            }
          },
        });

        log('loading level: all zones loaded');
        zones.checkDistances(userManager.player);
      });

      // Load entities
      log(`loading level: loading entities`);
      this.handleEntitiesSubscribe = this.subscribe('entities', levelId, () => {
        this.handleObserveEntities = Entities.find().observe({
          added(entity) {
            entityManager.create(entity);
          },
          changed(entity) {
            setTimeout(() => entityManager.update(entity), 0);
          },
          removed(entity) {
            entityManager.remove(entity);
          },
        });

        log('loading level: all entities loaded');
      });

      // Load tiles
      log(`loading level: loading tiles`);
      this.handleTilesSubscribe = this.subscribe('tiles', levelId, () => {
        this.handleObserveTiles = Tiles.find().observe({
          added(tile) {
            const layer = levelManager.tileLayer(tile);
            levelManager.map.putTileAt(levelManager.tileGlobalIndex(tile), tile.x, tile.y, false, layer);
            window.dispatchEvent(new CustomEvent('onTileAdded', { detail: { tile, layer } }));
          },
          changed(tile) {
            const layer = levelManager.tileLayer(tile);
            levelManager.map.putTileAt(levelManager.tileGlobalIndex(tile), tile.x, tile.y, false, layer);
            window.dispatchEvent(new CustomEvent('onTileChanged', { detail: { tile, layer } }));
          },
          removed(tile) {
            const layer = levelManager.tileLayer(tile);
            levelManager.map.removeTileAt(tile.x, tile.y, false, false, layer);
          },
        });

        log('loading level: all tiles loaded');
        levelManager.onLevelLoaded();
      });

      this.hasLevelLoaded = true;
      Session.set('menu', undefined);
      game.scene.getScene('EditorScene')?.init();
    });
  });

  this.autorun(() => {
    const currentLevel = Session.get('currentLevel');
    if (!currentLevel) {
      Meteor.call('currentLevel', (err, level) => { if (level) Session.set('currentLevel', level); });
    }
  });

  hotkeys('e', { scope: 'all' }, event => {
    if (event.repeat || !isEditionAllowed(Meteor.userId())) return;
    Session.set('editor', !Session.get('editor'));
  });

  hotkeys('shift+r', { scope: 'all' }, event => {
    if (event.repeat) return;
    game.scene.getScene('WorldScene')?.resetZoom();
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

    if (meet.api) {
      meet.close();
      game.scene.keys.WorldScene.updateViewport(viewportModes.fullscreen);
    } else {
      meet.open();
      game.scene.keys.WorldScene.updateViewport(viewportModes.splitScreen);
    }
  });

  hotkeys('u', { scope: scopes.player }, event => {
    event.preventDefault();
    if (event.repeat) return;
    userManager.interact();
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

  hotkeys('shift+1', { scope: scopes.player }, () => toggleUserProperty('shareAudio'));
  hotkeys('shift+2', { scope: scopes.player }, () => toggleUserProperty('shareVideo'));
  hotkeys('shift+3', { scope: scopes.player }, () => toggleUserProperty('shareScreen'));
  hotkeys('shift+4', { scope: scopes.player }, () => toggleModal('settingsMain'));
  hotkeys('shift+5', { scope: scopes.player }, () => toggleModal('notifications'));
  hotkeys('tab', { scope: scopes.player }, e => {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('userList');
  });
});

Template.lemverse.onDestroyed(function () {
  if (this.handleObserveUsers) this.handleObserveUsers.stop();
  if (this.handleObserveEntities) this.handleObserveEntities.stop();
  if (this.handleObserveTiles) this.handleObserveTiles.stop();
  if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
  if (this.handleObserveZones) this.handleObserveZones.stop();
  if (this.handleEntitiesSubscribe) this.handleEntitiesSubscribe.stop();
  if (this.handleTilesSubscribe) this.handleTilesSubscribe.stop();
  if (this.handleUsersSubscribe) this.handleUsersSubscribe.stop();
  if (this.handleZonesSubscribe) this.handleZonesSubscribe.stop();
  if (this.resizeObserver) this.resizeObserver.disconnect();

  hotkeys.unbind('e', scopes.player);
  hotkeys.unbind('f', scopes.player);
  hotkeys.unbind('j', scopes.player);
  hotkeys.unbind('l', scopes.player);
  hotkeys.unbind('r', scopes.player);
  hotkeys.unbind('shift+r', scopes.player);
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
  screenMode: () => Template.instance().screenMode.get(),
  settingsOpen: () => (!Session.get('modal') ? false : (Session.get('modal').template.indexOf('settings') !== -1)),
});

Template.lemverse.events({
  'click .button.audio'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareAudio');
  },
  'click .button.video'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareVideo');
  },
  'click .button.screen'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareScreen');
  },
  'click .button.settings'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('settingsMain');
  },
  'click .button.js-notifications'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('notifications');
  },
});
