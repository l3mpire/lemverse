import Phaser from 'phaser';

const editorGraphicsDepth = 10002;

const insertTile = data => {
  const user = Meteor.user();
  return Tiles.insert({ _id: Tiles.id(), createdAt: new Date(), createdBy: user._id, levelId: user.profile.levelId, ...data });
};

EditorScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function EditorScene() {
    Phaser.Scene.call(this, { key: 'EditorScene' });
  },

  init() {
    this.isMouseDown = false;
    this.undoTiles = [];
    this.redoTiles = [];
    this.mode = editorModes.tiles;

    // Use the camera of the main scene to have overlapping coordinates
    this.cameras.addExisting(game.scene.keys.WorldScene.cameras.main);

    this.marker = this.add.graphics();
    this.marker.setDefaultStyles({
      lineStyle: {
        width: 2,
        color: 0xffffff,
        alpha: 1,
      },
      fillStyle: {
        color: 0xffffff,
        alpha: 0.25,
      },
    });
    this.marker.setDepth(editorGraphicsDepth);

    this.areaSelector = this.add.graphics();
    this.areaSelector.setDefaultStyles({
      lineStyle: {
        width: 2,
        color: 0x02a3ff,
        alpha: 1,
      },
      fillStyle: {
        color: 0x02a3ff,
        alpha: 0.25,
      },
    });
    this.areaSelector.setDepth(editorGraphicsDepth);

    this.keys = this.input.keyboard.addKeys({
      alt: Phaser.Input.Keyboard.KeyCodes.ALT,
    }, false, false);

    this.events.on('wake', () => {
      Session.set('console', false);
      closeModal();
      this.onEditorModeChanged(Session.get('editorSelectedMenu'));
    });

    this.events.on('sleep', () => {
      Session.set('editor', 0);
      this.resetState();
    });

    // put editor in sleep mode on load (no rendering, no update)
    this.scene.sleep();
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

    const zoneId = Session.get('selectedZoneId');
    if (this.mode === editorModes.zones) {
      if (this.input.manager.activePointer.isDown && this.input.manager.activePointer.downElement.nodeName === 'CANVAS') this.isMouseDown = true;

      if (this.isMouseDown && !this.input.manager.activePointer.isDown) {
        this.isMouseDown = false;
        if (zoneId) {
          const zone = Zones.findOne(zoneId);
          if (!zone) return;
          const { startPosition, endPosition } = this.computePositions(zone, worldPoint, Session.get('selectedZonePoint'), altIsDown);

          Zones.update(zoneId, { $set: {
            x1: startPosition.x | 0,
            y1: startPosition.y | 0,
            x2: endPosition.x | 0,
            y2: endPosition.y | 0,
          } });

          if (!zone?.x2) {
            Session.set('selectedZonePoint', 2);
          } else {
            Session.set('selectedZoneId', undefined);
            Session.set('selectedZonePoint', undefined);
            this.areaSelector.visible = false;
          }
        }
      } else if (zoneId) {
        const zone = Zones.findOne(zoneId);
        if (!zone) return;

        const { startPosition, endPosition } = this.computePositions(zone, worldPoint, Session.get('selectedZonePoint'), altIsDown);
        const size = {
          x: endPosition.x - startPosition.x,
          y: endPosition.y - startPosition.y,
        };

        this.showSelection(startPosition.x, startPosition.y, size.x, size.y);
      }
    } else if (this.mode === editorModes.tiles) {
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
            const tileset = map.getTileset(tile.tilesetId);
            if (levelManager.tileLayer(tileset, tile.index) === layer) {
              this.undoTiles.push(tile);
              Tiles.remove(tile._id);
            }
          });
        } else if (selectedTiles) {
          const selectedTileset = Tilesets.findOne(selectedTiles.tilesetId);
          for (let x = 0; x < selectedTiles.w; x++) {
            for (let y = 0; y < selectedTiles.h; y++) {
              const selectedTileIndex = ((selectedTiles.y + y) * selectedTileset.width) / 16 + (selectedTiles.x + x);
              const layer = levelManager.tileLayer(map.getTileset(selectedTileset._id), selectedTileIndex);

              const tiles = Tiles.find({ x: pointerTileX + x, y: pointerTileY + y }).fetch();
              const tile = tiles.find(t => {
                const tileset = map.getTileset(t.tilesetId);
                return levelManager.tileLayer(tileset, t.index) === layer;
              });

              if (tile && (tile.index !== selectedTileIndex || tile.tilesetId !== selectedTileset._id)) {
                this.undoTiles.push(tile);
                Tiles.update(tile._id, { $set: { createdAt: new Date(), createdBy: Meteor.userId(), index: selectedTileIndex, tilesetId: selectedTileset._id } });
              } else if (!tile) {
                const tileId = insertTile({
                  x: pointerTileX + x,
                  y: pointerTileY + y,
                  index: selectedTileIndex,
                  tilesetId: selectedTileset._id,
                });
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
      const tileId = insertTile(tile);
      this.undoTiles.push({ _id: tileId, index: -1 });
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
      insertTile(tile);
    }
  },

  updateEditionMarker(selectedTiles) {
    if (!this.marker) return;
    if (!levelManager.map) return;

    const width = levelManager.map.tileWidth * (selectedTiles?.w || 1);
    const height = levelManager.map.tileHeight * (selectedTiles?.h || 1);
    this.marker.clear();
    this.marker.strokeRect(0, 0, width, height);
    this.marker.fillRect(0, 0, width, height);
  },

  showSelection(x, y, width, height) {
    this.areaSelector.visible = true;
    this.areaSelector.clear();
    this.areaSelector.strokeRect(x, y, width, height);
    this.areaSelector.fillRect(x, y, width, height);
  },

  computePositions(zone, mousePosition, editedPoint, snapPositions = false) {
    // snap
    if (snapPositions) mousePosition = this.snapToTile(mousePosition.x, mousePosition.y);

    let startPosition = { x: zone.x1 || mousePosition.x, y: zone.y1 || mousePosition.y };
    let endPosition = { x: zone.x2 || mousePosition.x, y: zone.y2 || mousePosition.y };

    // edit start or end
    if (editedPoint === 2) endPosition = mousePosition;
    else startPosition = mousePosition;

    // swap
    if (startPosition.x > endPosition.x) {
      const a = startPosition.x;
      startPosition.x = endPosition.x;
      endPosition.x = a;
    }

    if (startPosition.y > endPosition.y) {
      const a = startPosition.y;
      startPosition.y = endPosition.y;
      endPosition.y = a;
    }

    return { startPosition, endPosition };
  },

  onEditorModeChanged(mode) {
    this.updateEditionMarker(Session.get('selectedTiles'));
    this.marker.setVisible(mode === editorModes.tiles);
    entityManager.enableEdition(mode === editorModes.entities);
    this.mode = mode;
  },

  snapToTile(x, y) {
    const { tileHeight, tileWidth } = levelManager.map;

    return {
      x: Math.floor(x / tileWidth) * tileWidth,
      y: Math.floor(y / tileHeight) * tileHeight,
    };
  },

  resetState() {
    Session.set('selectedEntityId', undefined);
    Session.set('selectedZoneId', undefined);
    Session.set('selectedTiles', undefined);
    Session.set('selectedTilesetId', undefined);
    Session.set('selectedZonePoint', undefined);
    this.marker.setVisible(false);
    this.areaSelector.setVisible(false);
    entityManager.enableEdition(false);
  },
});
