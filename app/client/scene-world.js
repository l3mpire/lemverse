import nipplejs from 'nipplejs';

const Phaser = require('phaser');

const defaultLayer = 2;
const defaultLayerCount = 9;
const defaultLayerDepth = {
  6: 10000,
  7: 10001,
  8: 10002,
};

const findTileset = tilesetId => game.scene.keys.WorldScene.map.getTileset(tilesetId);

tileGlobalIndex = tile => {
  const tileset = findTileset(tile.tilesetId);
  return (tileset.firstgid || 0) + tile.index;
};

tileProperties = tile => {
  if (!tile.tilesetId) return {};
  return findTileset(tile.tilesetId).tileProperties?.[tile.index];
};

tileLayer = tile => tileProperties(tile)?.layer || defaultLayer;

WorldScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function WorldScene() {
    Phaser.Scene.call(this, { key: 'WorldScene' });
  },

  init(data) {
    this.layers = [];
    this.map = undefined;
    this.input.keyboard.enabled = false;
    this.nippleData = undefined;
    this.nippleMoving = false;
    this.scene.sleep();
    this.teleporterGraphics = [];
    userManager.init(this);
    userVoiceRecorderAbility.init(this);
    characterPopIns.init(this);
    this.physics.disableUpdate();

    const { levelId } = data;
    if (levelId && Meteor.user()) {
      const { spawn } = Levels.findOne({ _id: levelId });
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.levelId': levelId, 'profile.x': spawn?.x || 0, 'profile.y': spawn?.y || 0 } });
    }
  },

  create() {
    // map
    hotkeys.setScope('guest');
    this.map = this.make.tilemap({ tileWidth: 48, tileHeight: 48, width: 100, height: 100 });

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

    // layers
    this.initMapLayers();

    // Tilesets
    this.addTilesetsToLayers(Tilesets.find().fetch());

    // physics
    this.physics.world.bounds.width = this.map.widthInPixels;
    this.physics.world.bounds.height = this.map.heightInPixels;

    // cameras
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.roundPixels = true;

    // plugins
    userChatCircle.init(this);

    Session.set('gameCreated', true);
    Session.set('editor', 0);

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
    this.events.on('postupdate', this.postUpdate.bind(this), this);
    this.events.once('shutdown', this.shutdown.bind(this), this);

    zones.onZoneChanged = (zone, previousZone) => {
      if (previousZone && !previousZone.popInConfiguration?.autoOpen) characterPopIns.destroyPopIn(Meteor.userId(), previousZone._id);
      if (!zone) return;

      const { targetedLevelId: levelId, inlineURL } = zone;
      if (levelId) this.loadLevel(levelId);
      else if (inlineURL) characterPopIns.initFromZone(zone);
    };

    characterPopIns.onPopInEvent = e => {
      const { detail: data } = e;
      if (data.userId !== Meteor.userId()) return;

      if (data.type === 'load-level') this.loadLevel(data.levelId);
    };
  },

  addTilesetsToLayers(tilesets) {
    const newTilesets = [];
    _.each(tilesets, tileset => {
      if (findTileset(tileset._id)) return;
      const tilesetImage = this.map.addTilesetImage(tileset._id, tileset._id, 16, 16, 0, 0, tileset.gid);
      if (!tilesetImage) {
        log('unable to load tileset', tileset._id);
        return;
      }

      tilesetImage.tileProperties = tileset.tiles;
      newTilesets.push(tilesetImage);

      const collisionTileIndexes = _.map(tileset.collisionTileIndexes, i => i + tileset.gid);
      _.each(this.layers, layer => layer.setCollision(collisionTileIndexes));
    });

    if (newTilesets.length) _.each(this.layers, layer => layer.setTilesets([...layer.tileset, ...newTilesets]));
  },

  initMapLayers() {
    this.destroyMapLayers();
    _.times(defaultLayerCount, i => this.layers.push(this.map.createBlankLayer(`${i}`)));
    _.each(defaultLayerDepth, (value, key) => this.layers[key]?.setDepth(value));
  },

  destroyMapLayers() {
    _.each(this.layers, layer => {
      if (layer.playerCollider) this.physics.world?.removeCollider(layer.playerCollider);
      layer.destroy();
    });
    this.map.removeAllLayers();
    this.layers = [];
  },

  update() {
    userManager.interpolatePlayerPositions();
    userManager.handleUserInputs(this.keys, this.nippleMoving, this.nippleData);
  },

  postUpdate(time, delta) {
    userManager.postUpdate(time, delta);
  },

  loadLevel(levelId) {
    const levelToLoad = Levels.findOne({ _id: levelId });
    if (!levelToLoad) { error(`Level with the id "${levelId}" not found`); return; }

    game.scene.keys.LoadingScene.setText(levelToLoad.name);
    game.scene.keys.LoadingScene.show();
    setTimeout(() => this.scene.restart({ levelId }), 0);
  },

  onLevelLoaded() {
    this.scene.wake();

    // simulate a first frame update to avoid weirds visual effects with characters animation and direction
    this.update(0, 0);
    setTimeout(() => game.scene.keys.LoadingScene.hide(() => this.enableKeyboard(true)), 0);

    if (Meteor.settings.public.debug) {
      this.layers[0].renderDebug(this.add.graphics(), {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200),
        faceColor: new Phaser.Display.Color(40, 39, 37, 255),
      });
    }

    if (Tiles.find().count() === 0) this.drawTeleporters(true);
  },

  tileRefresh(x, y) {
    for (let i = 0; i < this.layers.length; i++) this.map.removeTileAt(x, y, false, false, i);

    Tiles.find({ x, y }).forEach(tile => {
      this.map.putTileAt(tileGlobalIndex(tile), tile.x, tile.y, false, tileLayer(tile));
    });
  },

  drawTeleporters(state) {
    // clean previous
    _.each(this.teleporterGraphics, zoneGraphic => zoneGraphic.destroy());
    this.teleporterGraphics = [];

    if (!state) return;

    // create new ones
    const zones = Zones.find({ $or: [{ targetedLevelId: { $exists: true, $ne: '' } }, { userLevelTeleporter: { $exists: true } }] }).fetch();
    _.each(zones, zone => {
      const graphic = this.add.rectangle(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, 0x9966ff, 0.2);
      graphic.setOrigin(0, 0);
      graphic.setStrokeStyle(1, 0xefc53f);
      graphic.setDepth(20000);
      this.teleporterGraphics.push(graphic);
    });
  },

  enableKeyboard(value, globalCapture) {
    const { keyboard } = this.input;
    if (!keyboard) return;
    keyboard.enabled = value;

    if (globalCapture) keyboard.enableGlobalCapture();
    else keyboard.disableGlobalCapture();
  },

  shutdown() {
    this.events.removeListener('postupdate');
    this.events.off('postupdate', this.postUpdate.bind(this), this);
    this.destroyMapLayers();
    this.map?.destroy();
    characterPopIns.destroy();
    userChatCircle.destroy();
    userVoiceRecorderAbility.destroy();
  },
});
