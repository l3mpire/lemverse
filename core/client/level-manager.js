import Phaser from 'phaser';

import networkManager from './network-manager';

const defaultMapConfig = { width: 100, height: 100, tileWidth: 48, tileHeight: 48 };
const defaultLayerCount = 10;
const defaultLayerDepth = { 6: 10000, 7: 10001, 8: 10002, 9: 10003 };
const defaultTileset = { layer: 2, firstgid: 0, tileProperties: {} };

levelManager = {
  layers: [],
  map: undefined,
  scene: undefined,
  teleporterGraphics: [],

  init(scene) {
    this.scene = scene;
  },

  createMapFromLevel(level) {
    this.map = this.scene.make.tilemap({ ...defaultMapConfig, ...level });
    this.initMapLayers();
    this.addTilesetsToLayers(Tilesets.find().fetch());

    // physics
    this.scene.physics.world.bounds.width = this.map.widthInPixels;
    this.scene.physics.world.bounds.height = this.map.heightInPixels;
  },

  destroy() {
    this.destroyMapLayers();
    this.map?.destroy();
  },

  onDocumentAdded(tile) {
    const tileset = this.map.getTileset(tile.tilesetId) || defaultTileset;
    const layer = this.tileLayer(tileset, tile.index);

    this.map.putTileAt(this.tileGlobalIndex(tileset, tile.index), tile.x, tile.y, false, layer);
    window.dispatchEvent(new CustomEvent(eventTypes.onTileAdded, { detail: { tile, layer } }));
  },

  onDocumentRemoved(tile) {
    const tileset = this.map.getTileset(tile.tilesetId) || defaultTileset;
    const layer = this.tileLayer(tileset, tile.index);

    this.map.removeTileAt(tile.x, tile.y, false, false, layer);
  },

  onDocumentUpdated(newTile) {
    const tileset = this.map.getTileset(newTile.tilesetId) || defaultTileset;
    const layer = this.tileLayer(tileset, newTile.index);

    this.map.putTileAt(this.tileGlobalIndex(tileset, newTile.index), newTile.x, newTile.y, false, layer);
    window.dispatchEvent(new CustomEvent(eventTypes.onTileChanged, { detail: { tile: newTile, layer } }));
  },

  update() {},

  addTilesetsToLayers(tilesets) {
    if (!this.map) return;

    const newTilesets = [];
    tilesets.forEach(tileset => {
      if (this.map.getTileset(tileset._id)) return;
      const tilesetImage = this.map.addTilesetImage(tileset._id, tileset.fileId, tileset.tileWidth || 16, tileset.tileHeight || 16, tileset.tileMargin || 0, tileset.tileSpacing || 0, tileset.gid);
      if (!tilesetImage) {
        log('unable to load tileset', tileset._id);
        return;
      }

      tilesetImage.tileProperties = tileset.tiles || {};
      newTilesets.push(tilesetImage);

      const collisionTileIndexes = _.map(tileset.collisionTileIndexes, i => i + tileset.gid);
      this.layers.forEach(layer => layer.setCollision(collisionTileIndexes));
    });

    if (newTilesets.length) this.layers.forEach(layer => layer.setTilesets([...layer.tileset, ...newTilesets]));
  },

  initMapLayers() {
    this.destroyMapLayers();

    Array.from({ length: defaultLayerCount }, (_, i) => {
      const layer = this.map.createBlankLayer(`${i}`);
      layer.setName(`${i}`);
      layer.setCullPadding(4, 4);
      if (defaultLayerDepth[i]) layer.setDepth(defaultLayerDepth[i]);

      if (i === 9) {
        layer.setAlpha(0.7);
      }
      this.layers.push(layer);

      return i;
    });
  },

  destroyMapLayers() {
    if (this.scene) {
      const { world } = this.scene.physics;
      this.layers.forEach(layer => {
        if (layer.playerCollider) world?.removeCollider(layer.playerCollider);
        layer.destroy();
      });
    }

    this.map?.removeAllLayers();
    this.layers = [];
  },

  loadLevel(levelId) {
    if (Meteor.user().profile.levelId === levelId) return;

    // avoid simulation sending new user position while the server is updating him (blocking scene update and inputs)
    this.scene.scene.pause();

    const loadingScene = game.scene.getScene('LoadingScene');
    loadingScene.setText('');
    loadingScene.show(() => {
      // Phaser sends the sleep event on the next frame which causes the client to overwrite the spawn position set by the server
      networkManager.onSleep();

      this.scene.scene.sleep();
      Meteor.call('teleportUserInLevel', levelId, (error, levelName) => {
        if (error) {
          lp.notif.error(`An error occured while loading the level (${error.error})`);
          this.onLevelLoaded();
          return;
        }

        loadingScene.setText(levelName);
      });
    });
  },

  tileRefresh(x, y) {
    this.layers.forEach((_layer, i) => this.map.removeTileAt(x, y, false, false, i));

    Tiles.find({ x, y }).forEach(tile => {
      const tileset = this.map.getTileset(tile.tilesetId) || defaultTileset;
      this.map.putTileAt(this.tileGlobalIndex(tileset, tile.index), tile.x, tile.y, false, this.tileLayer(tileset, tile.index));
    });
  },

  getTilesRelativeToPosition(position, offset, layers = []) {
    const tileX = this.map.worldToTileX(position.x + offset.x);
    const tileY = this.map.worldToTileY(position.y + offset.y);

    const tiles = [];
    if (layers.length === 0) {
      for (let l = this.map.layers.length; l >= 0; l--) {
        const tile = this.map.getTileAt(tileX, tileY, false, l);
        if (tile) tiles.push(tile);
      }
    } else {
      layers.forEach(l => {
        const tile = this.map.getTileAt(tileX, tileY, false, l);
        if (tile) tiles.push(tile);
      });
    }

    return tiles;
  },

  tileGlobalIndex(mapTileset, tileIndex) { return (mapTileset.firstgid || 0) + tileIndex; },

  tileLayer(mapTileset, tileIndex) { return mapTileset.tileProperties[tileIndex]?.layer ?? defaultTileset.layer; },

  onLevelLoaded() {
    this.scene.scene.wake();

    // simulate a first frame update to avoid weirds visual effects with characters animation and direction
    this.scene.update(0, 0);
    setTimeout(() => game.scene.keys.LoadingScene.hide(() => this.scene.enableKeyboard(true)), 0);

    if (Meteor.settings.public.debug) {
      this.layers[0].renderDebug(this.scene.add.graphics(), {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200),
        faceColor: new Phaser.Display.Color(40, 39, 37, 255),
      });
    }

    if (Tiles.find().count() === 0) this.drawTriggers(true);
  },

  onTilesetUpdated(newTileset, oldTileset) {
    if (!this.map) return;

    const tileset = this.map.getTileset(newTileset._id);
    if (newTileset.fileId !== oldTileset.fileId) {
      const bootScene = game.scene.getScene('BootScene');
      bootScene.loadImagesAtRuntime([newTileset], () => {
        this.scene.textures.remove(oldTileset.fileId);
        tileset.setImage(this.scene.textures.get(newTileset.fileId));
      });
    }

    tileset.tileProperties = newTileset.tiles;

    const oTileKeys = _.map(_.keys(oldTileset.tiles || {}), k => +k);
    const nTileKeys = _.map(_.keys(newTileset.tiles || {}), k => +k);
    const d1 = _.difference(oTileKeys, nTileKeys);
    const d2 = _.difference(nTileKeys, oTileKeys);
    const d3 = _.filter(oTileKeys, index => oldTileset.tiles[index]?.layer !== newTileset.tiles[index]?.layer);
    const changedTileIndexes = _.union(d1, d2, d3);
    const xys = _.map(Tiles.find({ tilesetId: newTileset._id, index: { $in: changedTileIndexes } }).fetch(), t => ({ x: t.x, y: t.y }));
    _.forEach(xys, xy => levelManager.tileRefresh(xy.x, xy.y));

    const enabledCollisionIndexes = _.difference(newTileset.collisionTileIndexes, oldTileset.collisionTileIndexes);
    const disabledCollisionIndexes = _.difference(oldTileset.collisionTileIndexes, newTileset.collisionTileIndexes);

    const enabledCollisionGlobalIndexes = _.map(enabledCollisionIndexes, i => this.tileGlobalIndex(newTileset, i));
    const disabledCollisionGlobalIndexes = _.map(disabledCollisionIndexes, i => this.tileGlobalIndex(newTileset, i));

    this.map.layers.forEach(layer => {
      this.map.setCollision(enabledCollisionGlobalIndexes, true, false, layer.tilemapLayer, true);
      this.map.setCollision(disabledCollisionGlobalIndexes, false, false, layer.tilemapLayer, true);
    });
  },

  drawTriggers(state) {
    // clean previous
    this.teleporterGraphics.forEach(zoneGraphic => zoneGraphic.destroy());
    this.teleporterGraphics = [];

    if (!state) return;

    // create zones
    const zones = Zones.find({ targetedLevelId: { $exists: true, $ne: '' } }).fetch();
    zones.forEach(zone => {
      const graphic = this.scene.add.rectangle(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, 0x9966ff, 0.2);
      graphic.setOrigin(0, 0);
      graphic.setStrokeStyle(1, 0xefc53f);
      graphic.setDepth(20000);
      this.teleporterGraphics.push(graphic);
    });

    // create entities trigger areas
    const entities = Entities.find().fetch();
    entities.forEach(entity => {
      if (!entity.triggerArea) return;

      const x1 = entity.x + entity.triggerArea.x;
      const y1 = entity.y + entity.triggerArea.y;
      const x2 = entity.triggerArea.w;
      const y2 = entity.triggerArea.h;

      const graphic = this.scene.add.rectangle(x1, y1, x2, y2, 0xFFFF00, 0.2);
      graphic.setOrigin(0, 0);
      graphic.setStrokeStyle(1, 0xFFFF00);
      graphic.setDepth(20000);
      this.teleporterGraphics.push(graphic);
    });
  },

  drawLayersToTarget(layers, target) {
    target.clear();

    layers.forEach(layer => {
      layer.setVisible(true);
      target.draw(layer);
      layer.setVisible(false);
    });
  },
};

Template.registerHelper('tileLayer', function () {
  if (this.index < 0) return defaultTileset.layer;

  const tileset = levelManager.map.getTileset(this.tilesetId);
  return levelManager.tileLayer(tileset, this.index);
});
Template.registerHelper('worldToTileX', x => levelManager.map.worldToTileX(x));
Template.registerHelper('worldToTileY', y => levelManager.map.worldToTileY(y));
