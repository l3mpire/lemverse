import nipplejs from 'nipplejs';
import Phaser from 'phaser';

const zoomConfig = Object.freeze({
  min: 0.6,
  max: 1.5,
  delta: 450,
});

const onZoneEntered = e => {
  const { guest } = Meteor.user().profile;
  const { zone } = e.detail;
  const { targetedLevelId, inlineURL, roomName, url, fullscreen, disableCommunications } = zone;
  sendEvent('zone-entered', { zone });

  if (targetedLevelId) levelManager.loadLevel(targetedLevelId);
  else if (inlineURL) characterPopIns.initFromZone(zone);

  if ((roomName && !guest) || url) updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
  if (disableCommunications) userManager.setUserInDoNotDisturbMode(true);
};

const onZoneLeaved = e => {
  const { zone } = e.detail;
  const { popInConfiguration, roomName, url, disableCommunications } = zone;
  sendEvent('zone-leaved', { zone });

  if (!popInConfiguration?.autoOpen) characterPopIns.destroyPopIn(`${Meteor.userId()}-${zone._id}`);

  if (roomName || url) updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
  if (disableCommunications) userManager.setUserInDoNotDisturbMode(false);
};

WorldScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function WorldScene() {
    Phaser.Scene.call(this, { key: 'WorldScene' });
  },

  init() {
    this.nippleData = undefined;
    this.nippleMoving = false;
    this.viewportMode = viewportModes.fullscreen;
    this.sleepMethod = this.sleep.bind(this);
    this.updateViewportMethod = mode => updateViewport(this, mode);
    this.postUpdateMethod = this.postUpdate.bind(this);
    this.shutdownMethod = this.shutdown.bind(this);

    // controls
    this.enableKeyboard(true, true);
    this.keys = this.input.keyboard.addKeys({
      ...this.input.keyboard.createCursorKeys(),
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    }, false, false);

    // set focus to the canvas and blur focused element on scene clicked
    this.input.on('pointerdown', () => {
      if (isModalOpen()) return;
      this.enableKeyboard(true, true);
      document.activeElement.blur();
    });

    // Notes: tilesets with extrusion are required to avoid potential black lines between tiles
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoom = Math.min(Math.max(this.cameras.main.zoom + (deltaY / zoomConfig.delta), zoomConfig.min), zoomConfig.max);
      const roundedZoom = Math.round(zoom * 1000) / 1000;
      this.cameras.main.setZoom(roundedZoom);
    });

    if (window.matchMedia('(pointer: coarse)').matches) {
      this.nippleManager = nipplejs.create({
        mode: 'dynamic',
        catchDistance: 150,
      });

      this.nippleManager.on('added', (evt, nipple) => {
        nipple.on('start move end dir plain', (evt2, data) => {
          if (evt2.type === 'move') {
            this.nippleMoving = true;
            this.nippleData = data;
          }
          if (evt2.type === 'end') this.nippleMoving = false;
        })
          .on('removed', () => nipple.off('start move end dir plain'));
      });
    }

    // events
    this.events.on('sleep', this.sleepMethod, this);
    this.events.on('postupdate', this.postUpdateMethod, this);
    this.events.once('shutdown', this.shutdownMethod, this);
    this.scale.on('resize', this.updateViewportMethod, this);
    hotkeys.setScope('guest');

    // custom events
    window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.addEventListener(eventTypes.onZoneLeaved, onZoneLeaved);

    this.scene.sleep();
    this.physics.disableUpdate();
    Session.set('sceneWorldReady', true);
    this.scene.setVisible(false);
  },

  initFromLevel(level) {
    entityManager.init(this);
    levelManager.init(this);
    userManager.init(this);
    zones.init(this);
    levelManager.createMapFromLevel(level);

    // cameras
    this.cameras.main.setBounds(0, 0, levelManager.map.widthInPixels, levelManager.map.heightInPixels);
    this.cameras.main.setRoundPixels(true);
    this.scene.setVisible(true);
  },

  update() {
    userManager.update();
  },

  postUpdate(time, delta) {
    userManager.postUpdate(time, delta);
    entityManager.postUpdate(time, delta);
  },

  enableKeyboard(value, globalCapture) {
    const { keyboard } = this.input;
    if (!keyboard) return;
    keyboard.enabled = value;

    if (globalCapture) keyboard.enableGlobalCapture();
    else keyboard.disableGlobalCapture();
  },

  enableMouse(value) {
    const { mouse } = this.input;
    if (!mouse) return;
    mouse.enabled = value;
  },

  resetZoom() {
    this.cameras.main.setZoom(zoomConfig.default);
  },

  sleep() {
    entityManager.onSleep();
    userManager.onSleep();
  },

  shutdown() {
    this.nippleManager?.destroy();

    this.events.removeListener('postupdate');
    this.events.off('postupdate', this.postUpdateMethod, this);
    this.events.off('sleep', this.sleepMethod, this);
    this.scale.off('resize', this.updateViewportMethod);
    window.removeEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.removeEventListener(eventTypes.onZoneLeaved, onZoneLeaved);

    levelManager.destroy();
    entityManager.destroy();
    userManager.destroy();
    userProximitySensor.callProximityEndedForAllNearUsers();
    peer.closeAll();

    Session.set('showScoreInterface', false);
    Session.set('sceneWorldReady', false);
  },
});
