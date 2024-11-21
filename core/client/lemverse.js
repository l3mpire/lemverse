import hotkeys from 'hotkeys-js';
import Phaser from 'phaser';
import audioManager from './audio-manager';
import meetingRoom from './meeting-room';
import { setReaction, updateFollowOffset } from './helpers';
import URLOpener from './url-opener';
import { guestAllowed, permissionTypes } from '../lib/misc';
import initSentryClient from './sentry';

initSentryClient();

scopes = {
  player: 'player',
  editor: 'editor',
  form: 'form',
};

hotkeys.filter = event => {
  const { tagName } = event.target;
  return !/^(INPUT|TEXTAREA)$/.test(tagName);
};

game = undefined;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  title: Meteor.settings.public.lp.product,
  url: Meteor.settings.public.lp.website,
  fps: {
    deltaHistory: 5,
  },
  input: {
    windowEvents: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: Meteor.settings.public.debug,
      gravity: { y: 0 },
      customUpdate: true,
    },
  },
  render: {
    pixelArt: true, // disable anti-aliasing & enable round pixels
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
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

const updateWindowTitle = levelDocument => {
  const titleParts = [Meteor.settings.public.lp.product];
  if (levelDocument.name) {
    titleParts.push(levelDocument.name);
    game.scene.getScene('LoadingScene')?.setText(levelDocument.name);
  }

  const title = titleParts.toReversed().join(' - ');
  window.history.replaceState({}, title, Meteor.settings.public.lp.website);
};

Template.lemverse.onCreated(function () {
  Session.set('editor', 0);
  Session.set('sceneWorldReady', false);
  Session.set('loading', true);
  Session.set('tilesetsLoaded', false);

  window.addEventListener('dblclick', e => {
    if (e.target === document.querySelector('canvas')) sendEvent('toggle-fullscreen');
  });

  window.addEventListener('beforeunload', () => {
    toggleUserProperty('shareScreen', false);
    peer.destroy();
  });

  window.addEventListener(eventTypes.onElementResized, event => {
    updateFollowOffset();
  });

  window.addEventListener(eventTypes.onZoneLeft, () => {
    const user = Meteor.user();
    const insideZones = zoneManager.findZonesForPosition({
      x: user.profile.x,
      y: user.profile.y,
    });

    const isSpecialZone = insideZones.some(zone => zone.url?.length > 0 || zone.roomName?.length > 0);
    if (!isSpecialZone) {
      const { WorldScene, UIScene } = game.scene.keys;
      WorldScene.cameras.main.followOffset.x = 0;
      UIScene.cameras.main.followOffset.x = 0;
    }
  });

  const extractedLevelId = extractLevelIdFromURL();
  if (extractedLevelId) Meteor.call('teleportUserInLevel', extractedLevelId);

  this.currentLevelId = undefined;
  this.subscribe('characters');

  this.subscribe('notifications', () => {
    this.handleObserveNotifications = Notifications.find({ createdAt: { $gte: new Date() } }).observe({
      async added(notification) {
        // remove notification when the user is already watching the channel targeted
        if (notification.type !== 'vocal' && notification.channelId === Session.get('messagesChannel')) {
          Notifications.remove(notification._id);
          return;
        }

        if (!notification.type) {
          audioManager.play('text-sound.wav', 0.5);
          notify(Meteor.users.findOne(notification.createdBy), `📢 You have received a new message`);
        }

        window.dispatchEvent(new CustomEvent(eventTypes.onNotificationReceived, { detail: { notification } }));
      },
    });
  });

  this.subscribe('tilesets', () => {
    log('All tilesets loaded');

    this.subscribe('assets', () => {
      log('All assets loaded');
      Session.set('tilesetsLoaded', true);
    });
  });

  this.autorun(() => {
    if (game || !Session.get('tilesetsLoaded')) return;
    game = new Phaser.Game(config);
    game.scene.add('BootScene', BootScene, true);

    Tracker.nonreactive(() => {
      const user = Meteor.user();
      if (!user) return;
      if (user.profile.guest && !guestAllowed(permissionTypes.talkToUsers)) return;

      peer.createMyPeer();
    });
  });

  this.autorun(() => {
    const { status } = Meteor.status();
    Tracker.nonreactive(() => {
      const user = Meteor.user();
      if (!user) return;
      if (user.profile.guest && !guestAllowed(permissionTypes.talkToUsers)) return;

      if (status === 'connected') peer.createMyPeer();
      else peer.peerInstance?.disconnect();
    });
  });

  this.autorun(() => {
    if (!Meteor.userId()) {
      Session.set('sceneWorldReady', false);
      userManager.setAsControlled();
    }
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;

    const menuOpen = Session.set('menu');
    const modalOpen = isModalOpen();
    Tracker.nonreactive(() => {
      const interfaceOpen = menuOpen || modalOpen;
      const worldScene = game.scene.getScene('WorldScene');
      worldScene.enableMouse(!interfaceOpen);
      worldScene.enableKeyboard(!modalOpen, !modalOpen);
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareAudio': 1 } });
    if (!user) return;
    Tracker.nonreactive(async () => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else if (!user.profile.shareAudio) userStreams.audio(false);
      else if (user.profile.shareAudio) {
        await userStreams.createStream();
        userProximitySensor.callProximityStartedForAllNearUsers();
      }

      if (meetingRoom.isOpen()) {
        const meetingRoomService = meetingRoom.getMeetingRoomService();
        if (user.profile.shareAudio) meetingRoomService.unmute();
        else meetingRoomService.mute();
      }
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareVideo': 1 } });
    if (!user) return;
    Tracker.nonreactive(async () => {
      if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);
      else if (!user.profile.shareVideo) userStreams.video(false);
      else if (user.profile.shareVideo) {
        const forceNewStream = userStreams.shouldCreateNewStream(streamTypes.main, true, true);
        await userStreams.createStream(forceNewStream);
        userProximitySensor.callProximityStartedForAllNearUsers();
      }

      if (meetingRoom.isOpen()) {
        const meetingRoomService = meetingRoom.getMeetingRoomService();
        if (user.profile.shareVideo) meetingRoomService.unhide();
        else meetingRoomService.hide();
      }
    });
  });

  this.autorun(() => {
    const user = Meteor.user({ fields: { 'profile.shareScreen': 1 } });
    if (!user) return;
    Tracker.nonreactive(async () => {
      if (meetingRoom.isOpen()) {
        const meetingRoomService = meetingRoom.getMeetingRoomService();
        if (user.profile.shareScreen) meetingRoomService.shareScreen();
        else meetingRoomService.unshareScreen();
      } else if (user.profile.shareScreen) {
        await userStreams.createScreenStream();
        userStreams.screen(true);
        userProximitySensor.callProximityStartedForAllNearUsers();
      } else {
        userStreams.screen(false);
      }
    });
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;
    const selectedMenu = Session.get('editorSelectedMenu');

    Tracker.nonreactive(() => game.scene.getScene('EditorScene')?.updateEditionMarker(selectedMenu));
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;
    const selectedMenu = Session.get('editorSelectedMenu');

    Tracker.nonreactive(() => game.scene.getScene('EditorScene')?.onEditorModeChanged(selectedMenu));
  });

  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;
    const bootScene = game.scene.getScene('BootScene');

    Tracker.nonreactive(() => {
      if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
      if (!this.handleObserveTilesets) {
        this.handleObserveTilesets = Tilesets.find().observe({
          added(tileset) {
            bootScene.loadImagesAtRuntime([tileset], levelManager.addTilesetsToLayers.bind(levelManager));
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
            const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;
            const spritesheet = { ...character, frameHeight, frameWidth };
            bootScene.loadImagesAtRuntime([spritesheet], () => bootScene.loadCharacterAnimations([spritesheet]));
          },
          changed(newCharacter, previousCharacter) {
            if (!newCharacter.category) return;

            const imageChanged = newCharacter.fileId !== previousCharacter?.fileId;
            if (imageChanged) {
              bootScene.unloadCharacterAnimations([newCharacter]);
              const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;
              const spritesheet = { ...newCharacter, frameHeight, frameWidth };
              bootScene.loadImagesAtRuntime([spritesheet], () => bootScene.loadCharacterAnimations([spritesheet]));
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

      URLOpener.close();
      loadingScene.show();

      if (this.currentLevelId) {
        log(`unloading current level…`);
        Session.set('editor', 0);
        worldScene.scene.restart();
        uiScene.onLevelUnloaded();
        levelManager.onLevelUnloaded(Levels.findOne(this.currentLevelId));

        this.currentLevelId = undefined;
        this.levelSubscribeHandler?.stop();

        return;
      }

      // subscribe to the loaded level
      log(`loading level: ${levelId || 'unknown'}…`);
      this.levelSubscribeHandler = this.subscribe('currentLevel', () => {
        const level = Levels.findOne(levelId);
        window.dispatchEvent(new CustomEvent(eventTypes.onLevelLoading, { detail: { level } }));

        updateWindowTitle(level);
        worldScene.initFromLevel(level);

        // Load tiles
        log(`loading level: loading tiles`);
        this.handleTilesSubscribe = this.subscribe('tiles', levelId, () => {
          this.handleObserveTiles = Tiles.find().observe({
            added(tile) { levelManager.onDocumentAdded(tile); },
            changed(newTile, oldTile) { levelManager.onDocumentUpdated(newTile, oldTile); },
            removed(tile) { levelManager.onDocumentRemoved(tile); },
          });

          log('loading level: all tiles loaded');
          uiScene.onLevelLoaded();
          levelManager.onLevelLoaded(level);

          // force canvas focus on level loaded
          document.activeElement.blur();
        });
      });

      // Load users
      log(`loading level: loading users`);
      this.handleUsersSubscribe = this.subscribe('users', levelId, () => {
        this.handleObserveUsers = Meteor.users.find({ 'status.online': true, 'profile.levelId': levelId }).observe({
          added(user) { userManager.onDocumentAdded(user); },
          changed(user, oldUser) { userManager.onDocumentUpdated(user, oldUser); },
          removed(user) {
            userManager.onDocumentRemoved(user);
            userProximitySensor.removeNearUser(user);
            lp.defer(() => peer.close(user._id, 0, 'user-disconnected'));
          },
        });

        log('loading level: all users loaded');
        peer.init();

        // Load entities
        log(`loading level: loading entities`);
        this.handleEntitiesSubscribe = this.subscribe('entities', levelId, () => {
          this.handleObserveEntities = Entities.find({ levelId, prefab: { $exists: false } }).observe({
            added(entity) { entityManager.onDocumentAdded(entity); },
            changed(newEntity, oldEntity) { entityManager.onDocumentUpdated(newEntity, oldEntity); },
            removed(entity) { entityManager.onDocumentRemoved(entity); },
          });
          log('loading level: all entities loaded');

          // Load zones (after entities because a zone can be linked to an entity and update his appearance)
          log(`loading level: loading zones`);
          this.handleZonesSubscribe = this.subscribe('zones', levelId, () => {
            this.handleObserveZones = Zones.find().observe({
              added(zone) { zoneManager.onDocumentAdded(zone); },
              changed(newZone, oldZone) { zoneManager.onDocumentUpdated(newZone, oldZone); },
              removed(zone) { zoneManager.onDocumentRemoved(zone); },
            });

            log('loading level: all zones loaded');
            zoneManager.checkDistances(userManager.getControlledCharacter());
          });
        });
      });

      this.currentLevelId = levelId;
      Session.set('menu', undefined);
    });
  });

  hotkeys('shift+r', { scope: 'all' }, event => {
    if (event.repeat) return;
    game.scene.getScene('WorldScene')?.resetZoom();
  });

  hotkeys('l', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    const user = Meteor.user();
    if (!user) return;

    const userReaction = user.profile.defaultReaction || Meteor.settings.public.defaultReaction;
    setReaction(event.type === 'keydown' ? userReaction : undefined);
  });

  hotkeys('f', { scope: scopes.player }, event => {
    if (event.repeat) return;
    event.preventDefault();
    userManager.follow(userProximitySensor.nearestUser(Meteor.user()));
  });

  hotkeys('u', { scope: scopes.player }, event => {
    event.preventDefault();
    if (event.repeat) return;
    userManager.interact();
  });

  hotkeys('p', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    if (event.type === 'keydown' && !userProximitySensor.nearUsersCount()) { lp.notif.error(`You need someone near you to whisper`); return; }

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
  if (this.handleObserveNotifications) this.handleObserveNotifications.stop();
  if (this.handleObserveTiles) this.handleObserveTiles.stop();
  if (this.handleObserveTilesets) this.handleObserveTilesets.stop();
  if (this.handleObserveZones) this.handleObserveZones.stop();
  if (this.handleEntitiesSubscribe) this.handleEntitiesSubscribe.stop();
  if (this.handleTilesSubscribe) this.handleTilesSubscribe.stop();
  if (this.handleUsersSubscribe) this.handleUsersSubscribe.stop();
  if (this.handleZonesSubscribe) this.handleZonesSubscribe.stop();
  if (this.resizeObserver) this.resizeObserver.disconnect();

  hotkeys.unbind('f', scopes.player);
  hotkeys.unbind('j', scopes.player);
  hotkeys.unbind('l', scopes.player);
  hotkeys.unbind('p', scopes.player);
  hotkeys.unbind('u', scopes.player);
  hotkeys.unbind('x', scopes.player);
  hotkeys.unbind('shift+r', scopes.player);
  hotkeys.unbind('tab', scopes.player);
});

Template.lemverse.helpers({
  allRemoteStreamsByUsers: () => peer.remoteStreamsByUsers.get(),
  guest: () => Meteor.user({ fields: { 'profile.guest': 1 } })?.profile.guest,
  onboarding: () => Meteor.settings.public.lp.enableOnboarding && Meteor.user({ fields: { 'profile.guest': 1 } })?.profile.guest && !Meteor.user({ fields: { username: 1 } })?.username,
  loading: () => Session.get('loading'),
  screenMode: () => Template.instance().screenMode.get(),
  settingsOpen: () => (!Session.get('modal') ? false : (Session.get('modal').template.indexOf('settings') !== -1)),
  modules: () => Session.get('modules'),
  mainModules: () => Session.get('mainModules'),
  gameModules: () => Session.get('gameModules'),
  displayNotificationButton: () => (Meteor.settings.public.features?.notificationButton?.enabled !== false),
  allowFormLogin: () => (Meteor.settings.public.permissions?.allowFormLogin !== false),
});

Template.lemverse.events({
  'mouseup .button.js-notifications'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleModal('notifications');
  },
});
