const Phaser = require('phaser');

EditorScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function EditorScene() {
    Phaser.Scene.call(this, { key: 'EditorScene' });
  },

  init() {
    this.marker = this.add.graphics();
    this.undoTiles = [];
    this.redoTiles = [];

    this.events.on('wake', () => {
      game.scene.keys.WorldScene.render.disableAutoPause(true);
      game.scene.keys.WorldScene.render.resume();
    });

    this.events.on('sleep', () => {
      game.scene.keys.WorldScene.render.disableAutoPause(false);
    });

    // put editor in sleep mode on load (no rendering, no update)
    game.scene.keys.EditorScene.scene.sleep();
  },

  update() {
    if (!Session.get('editor')) return;

    const { WorldScene } = game.scene.keys;
    const { map } = WorldScene;
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
          const point = Session.get('selectedZonePoint');
          Zones.update(zoneId, { $set: { [`x${point}`]: worldPoint.x | 0, [`y${point}`]: worldPoint.y | 0 } });

          const zone = Zones.findOne(zoneId);
          if (!zone?.x2) {
            Session.set('selectedZonePoint', 2);
          } else {
            Session.set('selectedZoneId', undefined);
            Session.set('selectedZonePoint', undefined);
          }
        }
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
            if (tileLayer(tile) === layer) {
              this.undoTiles.push(tile);
              Tiles.remove(tile._id);
            }
          });
        } else if (selectedTiles) {
          const user = Meteor.users.findOne(WorldScene.player.userId);
          const selectedTileset = Tilesets.findOne(selectedTiles.tilesetId);
          for (let x = 0; x < selectedTiles.w; x++) {
            for (let y = 0; y < selectedTiles.h; y++) {
              const selectedTileIndex = (selectedTiles.y + y) * selectedTileset.width / 16 + (selectedTiles.x + x);
              const layer = tileLayer({ tilesetId: selectedTiles.tilesetId, index: selectedTileIndex });

              // eslint-disable-next-line no-loop-func
              const tile = _.find(Tiles.find({ x: pointerTileX + x, y: pointerTileY + y }).fetch(), t => tileLayer({ tilesetId: t.tilesetId, index: t.index }) === layer);

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
    this.marker.clear();
    this.marker.lineStyle(2, 0x00FF00, 1);
    this.marker.strokeRect(0, 0, game.scene.keys.WorldScene.map.tileWidth * (selectedTiles?.w || 1), game.scene.keys.WorldScene.map.tileHeight * (selectedTiles?.h || 1));
    this.marker.setDepth(10002);
  },
});
