import hotkeys from 'hotkeys-js';

const Phaser = require('phaser');

scopes = {
  player: 'player',
  editor: 'editor',
  form: 'form',
};

scopesNotifications = {
  zone: 'zone',
  nearUsers: 'nearUsers',
};

hotkeys.filter = function (event) {
  const { tagName } = event.target || event.srcElement;
  return !/^(INPUT|TEXTAREA)$/.test(tagName);
};

game = undefined;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth / Meteor.settings.public.zoom,
  height: window.innerHeight / Meteor.settings.public.zoom,
  zoom: Meteor.settings.public.zoom,
  inputWindowEvents: false,
  title: Meteor.settings.public.lp.product,
  url: Meteor.settings.public.lp.website,
  fps: {
    min: 5,
    target: 60,
    forceSetTimeOut: false,
    deltaHistory: 5,
    panicMax: 120,
    smoothStep: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: Meteor.settings.public.debug,
      gravity: { y: 0 },
      useTree: false,
      customUpdate: true,
    },
  },
  render: {
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    antialiasGL: false,
    powerPreference: 'low-power',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800, // Default game window width
    height: 600, // Default game window height,
    autoRound: true,
    resizeInterval: 999999,
  },
  dom: {
    createContainer: true,
  },
};

const extractLevelIdFromURL = () => {
  const levelId = FlowRouter.getParam('levelId');
  if (!levelId) return undefined;
  return `lvl_${levelId}`;
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
  Session.set('console', false);

  window.addEventListener('dblclick', e => {
    if (e.target === document.querySelector('canvas')) sendEvent('toggle-fullscreen');
  });

  window.addEventListener('beforeunload', () => {
    toggleUserProperty('shareScreen', false);
    peer.destroy();
  });

  const extractedLevelId = extractLevelIdFromURL();
  if (extractedLevelId) Meteor.call('teleportUserInLevel', extractedLevelId);

  this.currentLevelId = undefined;
  this.subscribe('characters');
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

    Tracker.nonreactive(() => {
      if (!Meteor.user()?.profile.guest) peer.createMyPeer();

      // listen for click events on bubbles
      document.querySelector('#game div:first-of-type').addEventListener('click', e => {
        if (e.target.classList.contains('copy')) {
          const content = e.target.textContent;
          navigator.clipboard.writeText(content).then(() => lp.notif.success('Copied to clipboard! ✂️'));
        }
      });
    });
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

      if (meet.api) {
        if (user.profile.shareAudio) meet.unmute();
        else meet.mute();
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

      if (meet.api) {
        if (user.profile.shareVideo) meet.unhide();
        else meet.hide();
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
    const bootScene = game.scene.getScene('BootScene');

    Tracker.nonreactive(() => {
      if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
      if (!this.handleObserveTilesets) {
        this.handleObserveTilesets = Tilesets.find().observe({
          added(tileset) {
            bootScene.loadTilesetsAtRuntime([tileset], levelManager.addTilesetsToLayers.bind(levelManager));
          },
          changed(newTileset, oldTileset) {
            levelManager.onTilesetUpdated(newTileset, oldTileset);
          },
        });
      }

      if (this.handleObserveCharacters) this.handleObserveCharacters.stop();
      if (!this.handleObserveCharacters) {
        this.handleObserveCharacters = Characters.find().observe({
          added(character) {
            bootScene.loadCharactersAtRuntime([character]);
          },
          changed(newCharacter, previousCharacter) {
            if (!newCharacter.category) return;

            const imageChanged = newCharacter.fileId !== previousCharacter?.fileId;
            if (imageChanged) {
              bootScene.unloadCharacterAnimations([newCharacter]);
              bootScene.loadCharactersAtRuntime([newCharacter]);
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
    if (levelId === this.currentLevelId) return;

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
      const loadingScene = game.scene.getScene('LoadingScene');
      const worldScene = game.scene.getScene('WorldScene');
      const uiScene = game.scene.getScene('UIScene');
      loadingScene.show();

      if (this.currentLevelId) {
        log(`unloading current level…`);
        worldScene.scene.restart();
        uiScene.onLevelUnloaded();
        this.currentLevelId = undefined;
        this.levelSubscribeHandler?.stop();
        return;
      }

      // subscribe to the loaded level
      this.levelSubscribeHandler = this.subscribe('currentLevel', () => {
        // update title
        const level = Levels.findOne(levelId);
        const titleParts = [Meteor.settings.public.lp.product];
        if (level.name) {
          titleParts.push(level.name);
          loadingScene.setText(level.name);
        }
        document.title = titleParts.reverse().join(' - ');

        worldScene.initFromLevel(level);

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
          uiScene.onLevelLoaded();
          levelManager.onLevelLoaded();
        });
      });

      // Load users
      log(`loading level: ${levelId || 'unknown'}…`);
      log(`loading level: loading users`);
      this.handleUsersSubscribe = this.subscribe('users', levelId, () => {
        this.handleObserveUsers = Meteor.users.find({ status: { $exists: true } }).observe({
          added(user) {
            window.setTimeout(() => userManager.createUser(user), 0);
          },
          changed(user, oldUser) {
            window.setTimeout(() => userManager.updateUser(user, oldUser));
          },
          removed(user) {
            window.setTimeout(() => {
              userManager.removeUser(user);
              userProximitySensor.removeNearUser(user);
              lp.defer(() => peer.close(user._id, 0, 'user-disconnected'));
            }, 0);
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
              updateViewport(worldScene, screenMode);
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

      this.currentLevelId = levelId;
      Session.set('menu', undefined);
      game.scene.getScene('EditorScene')?.init();
    });
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
    if (event.repeat) return;
    event.preventDefault();

    if (meet.api) {
      const user = Meteor.user();
      if (!user.roles?.admin) return;

      const currentZone = zones.currentZone(user);
      if (currentZone) zones.setFullscreen(currentZone, !currentZone.fullscreen);
    } else userManager.follow(userProximitySensor.nearestUser(Meteor.user()));
  });

  hotkeys('u', { scope: scopes.player }, event => {
    event.preventDefault();
    if (event.repeat) return;
    userManager.interact();
  });

  hotkeys('r', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;
    userVoiceRecorderAbility.recordVoice(event.type === 'keydown', sendAudioChunksToUsersInZone);
  });

  hotkeys('p', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    const user = Meteor.user();
    if (!user.roles?.admin) return;
    if (!userProximitySensor.nearUsersCount() && event.type === 'keydown') { lp.notif.error(`You need someone near you to whisper`); return; }

    userVoiceRecorderAbility.recordVoice(event.type === 'keydown', sendAudioChunksToNearUsers);
  });

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
  'mouseup .button.audio'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareAudio');
  },
  'mouseup .button.video'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareVideo');
  },
  'mouseup .button.screen'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleUserProperty('shareScreen');
  },
  'mouseup .button.settings'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('settingsMain');
  },
  'mouseup .button.js-notifications'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleModal('notifications');
  },
});
