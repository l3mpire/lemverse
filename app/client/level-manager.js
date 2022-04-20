import Phaser from 'phaser';

const defaultMapConfig = { width: 100, height: 100, tileWidth: 48, tileHeight: 48 };
const defaultLayer = 2;
const defaultLayerCount = 9;
const defaultLayerDepth = { 6: 10000, 7: 10001, 8: 10002 };
const defaultTileset = { layer: defaultLayer, firstgid: 0, tileProperties: {} };

levelManager = {
  layers: [],
  map: undefined,
  mapRenderTextures: [],
  scene: undefined,
  teleporterGraphics: [],

  init(scene) {
    this.scene = scene;
  },

  createMapFromLevel(level) {
    this.map = this.scene.make.tilemap({ ...level, ...defaultMapConfig });
    this.initMapLayers();
    this.addTilesetsToLayers(Tilesets.find().fetch());

    // physics
    this.scene.physics.world.bounds.width = this.map.widthInPixels;
    this.scene.physics.world.bounds.height = this.map.heightInPixels;
  },

  destroy() {
    this.destroyMapLayers();
    this.enableRenderTexture(false);
    this.map?.destroy();
  },

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

      tilesetImage.tileProperties = tileset.tiles;
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
      layer.setCullPadding(2, 2);
      if (defaultLayerDepth[i]) layer.setDepth(defaultLayerDepth[i]);
      this.layers.push(layer);

      return i;
    });
  },

  destroyMapLayers() {
    const { world } = this.scene.physics;
    this.layers.forEach(layer => {
      if (layer.playerCollider) world?.removeCollider(layer.playerCollider);
      layer.destroy();
    });

    this.enableRenderTexture(false);
    this.map.removeAllLayers();
    this.layers = [];
  },

  loadLevel(levelId) {
    if (Meteor.user().profile.levelId === levelId) return;

    // avoid simulation sending new user position while the server is updating him (blocking scene update and inputs)
    this.scene.scene.pause();

    const loadingScene = game.scene.getScene('LoadingScene');
    loadingScene.setText('');
    loadingScene.show(() => {
      this.scene.scene.sleep();
      Meteor.call('teleportUserInLevel', levelId, (error, levelName) => {
        if (error) {
          lp.notif.error(`An error occured while loading the level ${levelId}`);
          return;
        }

        loadingScene.setText(levelName);
      });
    });
  },

  tileRefresh(x, y) {
    this.layers.forEach((layer, i) => this.map.removeTileAt(x, y, false, false, i));

    Tiles.find({ x, y }).forEach(tile => {
      this.map.putTileAt(this.tileGlobalIndex(tile), tile.x, tile.y, false, this.tileLayer(tile));
    });
  },

  tileGlobalIndex(tile) {
    const tileset = this.map.getTileset(tile.tilesetId);
    return (tileset?.firstgid || 0) + tile.index;
  },

  tileProperties(tile) {
    if (!tile.tilesetId) return defaultTileset;
    const tileset = this.map.getTileset(tile.tilesetId);
    if (!tileset) return defaultTileset;
    return tileset.tileProperties?.[tile.index];
  },

  tileLayer(tile) {
    return this.tileProperties(tile)?.layer ?? defaultLayer;
  },

  onLevelLoaded() {
    this.scene.scene.wake();

    // simulate a first frame update to avoid weirds visual effects with characters animation and direction
    this.scene.update(0, 0);
    this.enableRenderTexture(true);
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
      this.scene.load.image(newTileset.fileId, `/api/files/${newTileset.fileId}`);
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.scene.textures.remove(oldTileset.fileId);
        tileset.setImage(this.scene.textures.get(newTileset.fileId));
      });
      this.scene.load.start();
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

    const enabledCollisionGlobalIndexes = _.map(enabledCollisionIndexes, i => this.tileGlobalIndex({ index: i, tilesetId: newTileset._id }));
    const disabledCollisionGlobalIndexes = _.map(disabledCollisionIndexes, i => this.tileGlobalIndex({ index: i, tilesetId: newTileset._id }));

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

  enableRenderTexture(value) {
    if (!this.scene || !lp.isLemverseBeta('cachedMap')) return;

    if (value) {
      if (!this.mapRenderTextures.length) {
        const mapWidthInPixel = defaultMapConfig.width * defaultMapConfig.tileWidth;
        const mapHeightInPixel = defaultMapConfig.height * defaultMapConfig.tileHeight;

        const bellowMapRT = this.scene.add.renderTexture(0, 0, mapWidthInPixel, mapHeightInPixel);
        bellowMapRT.setDepth(0);
        this.mapRenderTextures.push(bellowMapRT);

        const aboveMapRT = this.scene.add.renderTexture(0, 0, mapWidthInPixel, mapHeightInPixel);
        aboveMapRT.setDepth(10000);
        this.mapRenderTextures.push(aboveMapRT);
      }

      this.refreshRenderTextures();
    }

    this.mapRenderTextures.forEach(mapRenderTexture => mapRenderTexture.setVisible(value));
    this.layers.forEach(layer => layer.setVisible(!value));
  },

  refreshRenderTextures() {
    if (!this.mapRenderTextures.length) return;
    const playerLayer = 2;

    const bellowLayers = this.layers.filter(layer => layer.depth <= playerLayer);
    this.drawLayersToTarget(bellowLayers, this.mapRenderTextures[0]);

    const aboveLayers = this.layers.filter(layer => layer.depth > playerLayer);
    this.drawLayersToTarget(aboveLayers, this.mapRenderTextures[1]);
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

Template.registerHelper('tileLayer', function () { return levelManager.tileLayer(this); });
Template.registerHelper('worldToTileX', x => levelManager.map.worldToTileX(x));
Template.registerHelper('worldToTileY', y => levelManager.map.worldToTileY(y));
