const Phaser = require('phaser');

EditorScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function EditorScene() {
    Phaser.Scene.call(this, { key: 'EditorScene' });
  },

  init() {
    this.isMouseDown = false;
    this.marker = game.scene.keys.WorldScene.add.graphics();
    this.undoTiles = [];
    this.redoTiles = [];
    this.areaSelector = game.scene.keys.WorldScene.add.graphics();
    this.areaSelector.visible = false;
    this.keys = this.input.keyboard.addKeys({
      alt: Phaser.Input.Keyboard.KeyCodes.ALT,
    }, false, false);

    // put editor in sleep mode on load (no rendering, no update)
    game.scene.keys.EditorScene.scene.sleep();

    this.events.on('wake', () => {
      this.marker.visible = true;
      this.updateEditionMarker(Session.get('selectedTiles'));
    });

    this.events.on('sleep', () => {
      this.marker.visible = false;
      this.areaSelector.visible = false;
    });
  },

  update() {
    if (!Session.get('editor')) return;

    const altIsDown = this.keys.alt.isDown;
    const { WorldScene } = game.scene.keys;
    const { map } = levelManager;
    const worldPoint = this.input.activePointer.positionToCamera(WorldScene.cameras.main);
    // Rounds down to nearest tile
    const pointerTileX = map.worldToTileX(worldPoint.x);
    const pointerTileY = map.worldToTileY(worldPoint.y);
    Session.set('pointerX', worldPoint.x | 0);
    Session.set('pointerY', worldPoint.y | 0);

    if (Session.get('editorSelectedMenu') === 2) {
      if (this.input.manager.activePointer.isDown && this.input.manager.activePointer.downElement.nodeName === 'CANVAS') this.isMouseDown = true;

      if (this.isMouseDown && !this.input.manager.activePointer.isDown) {
        this.isMouseDown = false;
        const zoneId = Session.get('selectedZoneId');
        if (zoneId) {
          let { x, y } = worldPoint;
          const point = Session.get('selectedZonePoint');
          if (altIsDown) {
            const { tileHeight, tileWidth } = levelManager.map;
            const snappedStartPosition = this.snapToTile(x, y);
            x = snappedStartPosition.x + ((point - 1) * tileWidth);
            y = snappedStartPosition.y + ((point - 1) * tileHeight);
          }

          Zones.update(zoneId, { $set: { [`x${point}`]: x | 0, [`y${point}`]: y | 0 } });

          const zone = Zones.findOne(zoneId);
          if (!zone?.x2) {
            Session.set('selectedZonePoint', 2);
          } else {
            Session.set('selectedZoneId', undefined);
            Session.set('selectedZonePoint', undefined);
            this.areaSelector.visible = false;
          }
        }
      }

      if (Session.get('selectedZoneId')) {
        const zoneId = Session.get('selectedZoneId');
        const zone = Zones.findOne(zoneId);
        let startPosition = { x: 0, y: 0 };
        let size = { x: 0, y: 0 };

        if (Session.get('selectedZonePoint') === 2) {
          startPosition = { x: zone.x1, y: zone.y1 };
          size = { x: worldPoint.x - startPosition.x, y: worldPoint.y - startPosition.y };
        } else {
          startPosition = { x: worldPoint.x, y: worldPoint.y };
          size = { x: (zone.x2 || worldPoint.x) - startPosition.x, y: (zone.y2 || worldPoint.y) - startPosition.y };
        }

        if (altIsDown) {
          const { tileHeight, tileWidth } = levelManager.map;
          const snappedStartPosition = this.snapToTile(startPosition.x, startPosition.y);
          const snappedSize = this.snapToTile(worldPoint.x - startPosition.x, worldPoint.y - startPosition.y);
          size.x = snappedSize.x + (snappedStartPosition.x - startPosition.x) + tileWidth;
          size.y = snappedSize.y + (snappedStartPosition.y - startPosition.y) + tileHeight;
        }

        this.showSelection(startPosition.x, startPosition.y, size.x, size.y);
      }
    } else if (Session.get('editorSelectedMenu') === 1) {
      // Snap to tile coordinates, but in world space
      this.marker.x = map.tileToWorldX(pointerTileX);
      this.marker.y = map.tileToWorldY(pointerTileY);

      let selectedTiles = Session.get('selectedTiles');

      if (WorldScene.keys.shift.isDown && this.input.manager.activePointer.isDown && this.input.manager.activePointer.downElement.nodeName === 'CANVAS') {
        let selectedTileGlobalIndex;
        for (let l = map.layers.length; l >= 0; l--) {
          selectedTileGlobalIndex = map.getTileAt(pointerTileX, pointerTileY, false, l)?.index;
          if (selectedTileGlobalIndex >= 0) break;
        }

        if (selectedTileGlobalIndex >= 0) {
          if (!selectedTiles) selectedTiles = {};

          const tileset = Tilesets.findOne({ gid: { $lte: selectedTileGlobalIndex } }, { sort: { gid: -1 } });
          const tileIndex = selectedTileGlobalIndex - tileset.gid;

          selectedTiles.tilesetId = tileset._id;
          selectedTiles.index = tileIndex;
          selectedTiles.x = (tileIndex % (tileset.width / 16));
          selectedTiles.y = (tileIndex / (tileset.width / 16) | 0);
          selectedTiles.w = 1;
          selectedTiles.h = 1;

          Session.set('selectedTiles', selectedTiles);
        }
      } else if (this.input.manager.activePointer.isDown && this.input.manager.activePointer.downElement.nodeName === 'CANVAS') {
        if (selectedTiles?.index === -99) {
          Tiles.find({ x: pointerTileX, y: pointerTileY }).forEach(tile => {
            this.undoTiles.push(tile);
            Tiles.remove(tile._id);
          });
        } else if (selectedTiles?.index < 0) {
          const layer = -selectedTiles.index - 1;
          Tiles.find({ x: pointerTileX, y: pointerTileY }).forEach(tile => {
            if (levelManager.tileLayer(tile) === layer) {
              this.undoTiles.push(tile);
              Tiles.remove(tile._id);
            }
          });
        } else if (selectedTiles) {
          const user = Meteor.users.findOne(userManager.player.userId);
          const selectedTileset = Tilesets.findOne(selectedTiles.tilesetId);
          for (let x = 0; x < selectedTiles.w; x++) {
            for (let y = 0; y < selectedTiles.h; y++) {
              const selectedTileIndex = (selectedTiles.y + y) * selectedTileset.width / 16 + (selectedTiles.x + x);
              const layer = levelManager.tileLayer({ tilesetId: selectedTiles.tilesetId, index: selectedTileIndex });

              // eslint-disable-next-line no-loop-func
              const tile = _.find(Tiles.find({ x: pointerTileX + x, y: pointerTileY + y }).fetch(), t => levelManager.tileLayer({ tilesetId: t.tilesetId, index: t.index }) === layer);

              if (tile && (tile.index !== selectedTileIndex || tile.tilesetId !== selectedTileset._id)) {
                this.undoTiles.push(tile);
                Tiles.update(tile._id, { $set: { createdAt: new Date(), createdBy: user._id, index: selectedTileIndex, tilesetId: selectedTileset._id } });
              } else if (!tile) {
                const { levelId } = user.profile;
                const tileId = Tiles.insert({ _id: Tiles.id(), createdAt: new Date(), createdBy: user._id, x: pointerTileX + x, y: pointerTileY + y, index: selectedTileIndex, tilesetId: selectedTileset._id, levelId });
                this.undoTiles.push({ _id: tileId, index: -1 });
              }
            }
          }
        }
      }
    }
  },

  redo() {
    if (!this.redoTiles.length) return;
    const tile = this.redoTiles.pop();

    const currentTile = Tiles.findOne(tile._id);
    if (tile.index === -1) {
      this.undoTiles.push(currentTile);
      Tiles.remove(tile._id);
    } else if (currentTile) {
      this.undoTiles.push(currentTile);
      Tiles.update(tile._id, { $set: tile });
    } else {
      Tiles.insert(tile);
      this.undoTiles.push({ _id: tile._id, index: -1 });
    }
  },

  undo() {
    if (!this.undoTiles.length) return;
    const tile = this.undoTiles.pop();

    const currentTile = Tiles.findOne(tile._id);
    if (tile.index === -1) {
      this.redoTiles.push(currentTile);
      Tiles.remove(tile._id);
    } else if (currentTile) {
      this.redoTiles.push(currentTile);
      Tiles.update(tile._id, { $set: tile });
    } else {
      this.redoTiles.push({ _id: tile._id, index: -1 });
      Tiles.insert(tile);
    }
  },

  updateEditionMarker(selectedTiles) {
    if (!this.marker) return;

    const width = levelManager.map.tileWidth * (selectedTiles?.w || 1);
    const height = levelManager.map.tileHeight * (selectedTiles?.h || 1);
    this.marker.clear();
    this.marker.lineStyle(2, 0xFFFFFF, 1);
    this.marker.strokeRect(0, 0, width, height);
    this.marker.fillStyle(0xFFFFFF, 0.25);
    this.marker.fillRect(0, 0, width, height);
    this.marker.setDepth(10002);
  },

  showSelection(x, y, width, height) {
    this.areaSelector.visible = true;
    this.areaSelector.clear();
    this.areaSelector.strokeRect(x, y, width, height);
    this.areaSelector.fillRect(x, y, width, height);
  },

  snapToTile(x, y) {
    const { tileHeight, tileWidth } = levelManager.map;

    return {
      x: Math.floor(x / tileWidth) * tileWidth,
      y: Math.floor(y / tileHeight) * tileHeight,
    };
  },
});
