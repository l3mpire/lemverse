import nipplejs from 'nipplejs';
import Phaser from 'phaser';

import { clamp } from '../helpers';

const fixedUpdateInterval = 200;
const zoomConfig = Meteor.settings.public.zoom;

const onZoneEntered = e => {
  const { zone } = e.detail;
  const { targetedLevelId, inlineURL, url, disableCommunications } = zone;

  if (targetedLevelId) levelManager.loadLevel(targetedLevelId);
  else if (inlineURL) characterPopIns.initFromZone(zone);

  if (url) zoneManager.openZoneURL(zone);
  if (disableCommunications) userManager.setUserInDoNotDisturbMode(true);
};

const onZoneLeft = e => {
  const { zone } = e.detail;
  const { popInConfiguration, disableCommunications, url } = zone;

  if (!popInConfiguration?.autoOpen) characterPopIns.destroyPopIn(`${Meteor.userId()}-${zone._id}`);

  if (url) {
    updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
    zoneManager.closeIframeElement();
  }
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
    this.resizeMethod = this.resize.bind(this);
    this.postUpdateMethod = this.postUpdate.bind(this);
    this.shutdownMethod = this.shutdown.bind(this);
    this.fixedUpdateInterval = setInterval(() => this._fixedUpdate(), fixedUpdateInterval);

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
      if (isModalOpen() || Session.get('console')) return;
      this.enableKeyboard(true, true);
      document.activeElement.blur();
    });

    // Notes: tilesets with extrusion are required to avoid potential black lines between tiles (see https://github.com/sporadic-labs/tile-extruder)
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      this.zoomDelta(deltaY);
    });

    if (window.matchMedia('(pointer: coarse)').matches) {
      this.nippleManager = nipplejs.create({
        mode: 'dynamic',
        zone: document.querySelector('#game'),
        catchDistance: 150,
        dynamicPage: true,
      });

      this.nippleManager.on('added', (_event, nipple) => {
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
    this.scale.on('resize', this.resizeMethod, this);
    hotkeys.setScope('guest');

    // custom events
    window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.addEventListener(eventTypes.onZoneLeft, onZoneLeft);

    this.scene.sleep();
    this.physics.disableUpdate();
    Session.set('sceneWorldReady', true);
    this.scene.setVisible(false);
    window.dispatchEvent(new CustomEvent(eventTypes.onWorldSceneCreated, { detail: { scene: this } }));

    entityManager.init(this);
    levelManager.init(this);
    userManager.init(this);
    zoneManager.init(this);
  },

  create() {
    const pinchPlugin = this.plugins.get('rexpinchplugin').add(this);

    // Disable joystick to avoid user moving while zooming
    pinchPlugin.on('pinchstart', function () {
      const nipple = this.nippleManager.get(this.nippleManager.ids[0]);
      nipple.destroy();
    }, this);

    pinchPlugin.on('pinch', function (pinch) {
      this.zoomDelta(-(pinch.scaleFactor - 1) * 100 * zoomConfig.pinchDelta);
    }, this);
  },

  zoomDelta(delta) {
    const linearFactor = this.cameras.main.zoom * zoomConfig.factor;
    const clampedDelta = clamp(delta, -zoomConfig.maxDelta, zoomConfig.maxDelta);
    const zoom = clamp(this.cameras.main.zoom - (clampedDelta * linearFactor), zoomConfig.min, zoomConfig.max);
    this.setClampedZoom(this.cameras.main, zoom);
  },

  initFromLevel(level) {
    levelManager.createMapFromLevel(level);

    // cameras
    this.cameras.main.setBounds(0, 0, levelManager.map.widthInPixels, levelManager.map.heightInPixels);
    this.cameras.main.setRoundPixels(true);
    this.resetZoom();
    this.scene.setVisible(true);
  },

  _fixedUpdate() {
    entityManager.fixedUpdate();
  },

  update() {
    levelManager.update();
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
    this.setClampedZoom(this.cameras.main, zoomConfig.default);
  },

  resize(mode) {
    this.setClampedZoom(this.cameras.main, this.cameras.main.zoom);
    updateViewport(this, mode);
  },

  setClampedZoom(camera, zoom) {
    const bounds = camera.getBounds();
    const { height, width } = camera;

    if (bounds.height * zoom < height || bounds.width * zoom < width) {
      zoom = Math.max(height / bounds.height, width / bounds.width);
    }
    camera.setZoom(zoom);
  },

  sleep() {
    userManager.onSleep();
  },

  shutdown() {
    this.nippleManager?.destroy();

    clearInterval(this.fixedUpdateInterval);
    this.events.removeListener('postupdate');
    this.events.off('postupdate', this.postUpdateMethod, this);
    this.events.off('sleep', this.sleepMethod, this);
    this.scale.off('resize', this.updateViewportMethod);
    window.removeEventListener(eventTypes.onZoneEntered, onZoneEntered);
    window.removeEventListener(eventTypes.onZoneLeft, onZoneLeft);

    levelManager.destroy();
    entityManager.destroy();
    userManager.destroy();
    zoneManager.destroy();
    userProximitySensor.callProximityEndedForAllNearUsers();
    peer.closeAll();

    Session.set('sceneWorldReady', false);
  },
});
