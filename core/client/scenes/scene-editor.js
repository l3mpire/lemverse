import Phaser from 'phaser';

import { canEditActiveLevel } from '../../lib/misc';

const editorGraphicsDepth = 10002;

const previewInfo = {
  lastMousePosition: {},
  previousTiles: [],
  recalculatePreview: false,
};

let isSelecting = false;
let selection = {};
let timerResetCopyPaste;


function compareMouseMovements(currentPosition, lastMousePosition) {
  return currentPosition.x === lastMousePosition.x && currentPosition.y === lastMousePosition.y;
}

function clearLastPreviewTiles() {
  const { previousTiles } = previewInfo;
  const { map } = levelManager;
  if (previousTiles === null) return;

  for (let i = 0; i < previousTiles.length; i += 1) {
    const tile = previousTiles[i];
    if (tile.index !== undefined) {
      map.putTileAt(tile.index, tile.x, tile.y, false, tile.layer)?.setAlpha(1);
    } else {
      map.removeTileAt(tile.x, tile.y, true, false, tile.layer);
    }
  }
}

const insertTile = data => {
  const user = Meteor.user();
  return Tiles.insert({ _id: Tiles.id(), createdAt: new Date(), createdBy: user._id, levelId: user.profile.levelId, ...data });
};

function getDatabaseTile(x, y, localTile) {
  const databaseTileset = Tilesets.findOne({ gid: { $lte: localTile.index } }, { sort: { gid: -1 } });
  const tileLocalIndex = localTile.index - databaseTileset.gid;
  const data = {
    x,
    y,
    tilesetId: databaseTileset._id,
    index: tileLocalIndex,
  };
  return Tiles.findOne(data);
}


EditorScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function EditorScene() {
    Phaser.Scene.call(this, { key: 'EditorScene' });
  },

  newEntityCollider() {
    const collider = this.add.graphics();
    collider.setDefaultStyles({
      lineStyle: {
        width: 2,
        color: 0x00ff00,
        alpha: 1,
      },
      fillStyle: {
        color: 0x00ff00,
        alpha: 0.25,
      },
    });

    return collider.setDepth(editorGraphicsDepth);
  },


  init() {
    this.isMouseDown = false;
    this.undoTiles = [];
    this.redoTiles = [];
    this.mode = editorModes.tiles;

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

    this.entityCollider = {};

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
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }, false, false);

    this.events.on('wake', () => {
      Session.set('console', false);
      closeModal();
      this.bindWorldSceneCamera();
      this.onEditorModeChanged(Session.get('editorSelectedMenu'));
    });

    this.events.on('sleep', () => {
      Session.set('editor', 0);
      this.resetState();
    });

    // put editor in sleep mode on load (no rendering, no update)
    this.scene.sleep();

    hotkeys('e', { scope: 'all' }, event => {
      if (event.repeat || !canEditActiveLevel(Meteor.user())) return;
      Session.set('editor', !Session.get('editor'));
    });
  },

  // We need to use the world scene camera to have the same camera transformation matrix
  bindWorldSceneCamera() {
    const worldSceneCamera = game.scene.keys.WorldScene.cameras.main;
    this.cameras.addExisting(worldSceneCamera, true);

    const camerasToDestroy = this.cameras.cameras.filter(camera => camera !== worldSceneCamera);
    this.cameras.remove(camerasToDestroy, true);
  },

  clearCopyPasteMode() {
    this.marker.defaultStrokeColor = 0xffffff;
    this.updateEditionMarker();
    selection = {};
    isSelecting = false;
  },

  update() {
    if (!Session.get('editor')) return;

    const shiftIsDown = this.keys.shift.isDown;
    const altIsDown = this.keys.alt.isDown;
    const canvasClicked = this.input.manager.activePointer.downElement?.nodeName === 'CANVAS';
    const { map } = levelManager;

    const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
    // Rounds down to nearest tile
    const pointerTileX = map.worldToTileX(worldPoint.x);
    const pointerTileY = map.worldToTileY(worldPoint.y);
    Session.set('pointerX', worldPoint.x | 0);
    Session.set('pointerY', worldPoint.y | 0);

    const zoneId = Session.get('selectedZoneId');

    Object.values(this.entityCollider).forEach(val => {
      val.clear();
    });

    if (this.mode === editorModes.zones) {
      if (this.input.manager.activePointer.isDown && canvasClicked) this.isMouseDown = true;

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
      if (selection.x !== undefined) {
        this.marker.x = map.tileToWorldX(selection.x);
        this.marker.y = map.tileToWorldY(selection.y);
      } else {
        this.marker.x = map.tileToWorldX(pointerTileX);
        this.marker.y = map.tileToWorldY(pointerTileY);
      }

      const selectedTiles = Session.get('selectedTiles');

      const currentMousePosition = { x: pointerTileX, y: pointerTileY };
      const updateMousePosition = !compareMouseMovements(currentMousePosition, previewInfo.lastMousePosition);

      // preview tiles
      if (updateMousePosition || previewInfo.recalculatePreview) {
        previewInfo.recalculatePreview = false;
        if (selectedTiles) {
          const selectedTileset = Tilesets.findOne(selectedTiles.tilesetId);

          const mapSelectedTileset = map.getTileset(selectedTiles.tilesetId);

          if (mapSelectedTileset) {
            // We have to clear in a seperate loop, because we need the layer to be clear to draw over.
            // That way we can only render on mouse movements.
            // This has a complexity of 2n^2 every mouse movements instead of n^2 every frame.
            clearLastPreviewTiles();

            const previousTiles = [];

            for (let x = 0; x < selectedTiles.w; x++) {
              for (let y = 0; y < selectedTiles.h; y++) {
                const selectedTileIndex = ((selectedTiles.y + y) * selectedTileset.width) / 16 + (selectedTiles.x + x);
                const globalSelectedTileIndex = levelManager.tileGlobalIndex(mapSelectedTileset, selectedTileIndex);

                const tile = {
                  x: pointerTileX + x,
                  y: pointerTileY + y,
                  index: globalSelectedTileIndex,
                };

                const layer = levelManager.tileLayer(mapSelectedTileset, selectedTileIndex);
                const previousTile = map.getTileAt(tile.x, tile.y, false, layer);

                previousTiles.push({
                  index: previousTile?.index,
                  x: tile.x,
                  y: tile.y,
                  layer,
                });

                if ((previousTile && previousTile.index !== tile.index) || !previousTile) {
                  map.putTileAt(tile.index, tile.x, tile.y, false, layer)?.setAlpha(0.65);
                }
              }
            }
            previewInfo.previousTiles = previousTiles;
          } else {
            clearLastPreviewTiles();
          }
        } else if (selection.x !== undefined && !isSelecting) {
          clearLastPreviewTiles();

          const previousTiles = [];

          for (let x = 0; x < selection.w; x++) {
            for (let y = 0; y < selection.h; y++) {
              const copyX = selection.x + x;
              const copyY = selection.y + y;

              const currentTileX = pointerTileX + x;
              const currentTileY = pointerTileY + y;

              const layers = map.layers.length;
              for (let layer = 0; layer < layers; layer++) {
                const tileToCopy = map.getTileAt(copyX, copyY, false, layer);

                // Disabling this for now to have an algorithm in Θ(x*y*l) instead of Θ(x*y*(l+m)) with a higher memory usage
                // eslint-disable-next-line no-continue
                if (!tileToCopy) continue;

                const previousTile = map.getTileAt(currentTileX, currentTileY, false, layer);

                previousTiles.push({
                  index: previousTile?.index,
                  x: currentTileX,
                  y: currentTileY,
                  layer,
                });

                if ((previousTile && previousTile.index !== tileToCopy.index) || !previousTile) {
                  map.putTileAt(tileToCopy.index, currentTileX, currentTileY, false, layer)?.setAlpha(0.65);
                }
              }
            }
          }
          previewInfo.previousTiles = previousTiles;
        } else {
          clearLastPreviewTiles();
        }
      }


      previewInfo.lastMousePosition = currentMousePosition;

      if (shiftIsDown) {
        clearLastPreviewTiles();
        previewInfo.recalculatePreview = true;
      }

      // quit selecting mode (copy/paste)
      if (!shiftIsDown && isSelecting) {
        this.marker.defaultStrokeColor = 0x00ff00;
        isSelecting = false;
        this.updateEditionMarker(selection);
      }

      // pasting
      if (selection.x !== undefined && !isSelecting && !shiftIsDown && this.input.manager.activePointer.isDown && canvasClicked) {
        // lock paste every 100ms to avoid spamming
        const date = Date.now();
        if (timerResetCopyPaste) {
          if (date - timerResetCopyPaste < 500) {
            return;
          }
        }
        timerResetCopyPaste = date;
        clearLastPreviewTiles();
        previewInfo.previousTiles = [];
        for (let x = 0; x < selection.w; x++) {
          for (let y = 0; y < selection.h; y++) {
            const copyX = selection.x + x;
            const copyY = selection.y + y;

            const pointerOffsetX = pointerTileX + x;
            const pointerOffsetY = pointerTileY + y;

            for (let layer = 0; layer < map.layers.length; layer++) {
              const tileToCopy = map.getTileAt(copyX, copyY, false, layer);

              // clearing layers that WERE used, but WONT be anymore by the copy
              const tileToUpdate = map.getTileAt(pointerTileX + x, pointerTileY + y, false, layer);
              if (!tileToCopy) {
                if (tileToUpdate) {
                  Tiles.remove(getDatabaseTile(pointerOffsetX, pointerOffsetY, tileToUpdate)._id);
                }

                // Disabling this for now to have an algorithm in Θ(x*y*l) instead of Θ(x*y*(l+m)) with a higher memory usage
                // eslint-disable-next-line no-continue
                continue;
              }

              const databaseTilesetToCopy = Tilesets.findOne({ gid: { $lte: tileToCopy.index } }, { sort: { gid: -1 } });
              const tileToCopyLocalIndex = tileToCopy.index - databaseTilesetToCopy.gid;

              // updating tile that already exists
              if (tileToUpdate && tileToCopy.index !== tileToUpdate.index) {
                const databaseTileToUpdate = getDatabaseTile(pointerOffsetX, pointerOffsetY, tileToUpdate);
                if (!databaseTileToUpdate) return

                this.undoTiles.push(databaseTileToUpdate);
                Tiles.update(databaseTileToUpdate._id, { $set: { createdAt: new Date(), createdBy: Meteor.userId(), index: tileToCopyLocalIndex, tilesetId: databaseTilesetToCopy._id } });
              } else if (!tileToUpdate) {
                const data = {
                  x: pointerTileX + x,
                  y: pointerTileY + y,
                  tilesetId: databaseTilesetToCopy._id,
                  index: tileToCopyLocalIndex,
                };
                const tileId = insertTile(data);
                this.undoTiles.push({ _id: tileId, index: -1 });
              }
            }
          }
        }
        return;
      }

      if (shiftIsDown && this.input.manager.activePointer.isDown && canvasClicked) {
        // only clear if shift + click
        if (selectedTiles) {
          this.updateEditionMarker(selection);

          Session.set('selectedTiles', undefined);
          this.marker.defaultStrokeColor = 0xff0000;
        }

        if (!isSelecting) {
          // start a new copy-selection
          this.clearCopyPasteMode();
          timerResetCopyPaste = Date.now();


          this.marker.defaultStrokeColor = 0x0000ff;
          isSelecting = true;
          selection = { x: pointerTileX, y: pointerTileY, w: 1, h: 1 };
        } else if (updateMousePosition) {
          // update current copy-selection
          selection.w = pointerTileX - selection.x + 1;
          selection.h = pointerTileY - selection.y + 1;
          this.updateEditionMarker(selection);
        }

        return;
      }
      if (selectedTiles) {
        // quit copy past mode
        this.clearCopyPasteMode();
      }


      if (this.input.manager.activePointer.isDown && canvasClicked) {
        previewInfo.previousTiles = null;
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
    } else if (this.mode === editorModes.entities) {
      const entities = Entities.find({ mapId: map._id }).fetch();

      entities.forEach(entity => {
        if (entity.gameObject?.collider) {
          if (!this.entityCollider[entity._id]) this.entityCollider[entity._id] = this.newEntityCollider()
          const collider = this.entityCollider[entity._id]

          if (entity.gameObject.scale < 0) return

          var collision;
          if (entity.gameObject.collider.radius) {
            // the problem is that the collider is drawn at the center of the entity, but the position is at the top left corner
            collision = {
              x: entity.gameObject.collider.x + entity.gameObject.collider.radius,
              y: entity.gameObject.collider.y + entity.gameObject.collider.radius,
              radius: entity.gameObject.collider.radius,
            }
          }
          else {
            collision = { x: entity.gameObject.collider.x, y: entity.gameObject.collider.y, w: entity.gameObject.collider.width, h: entity.gameObject.collider.height };
          }

          for (const key in collision) {
            collision[key] *= entity.gameObject.scale ?? 1;
          }
          collision.x += entity.x;
          collision.y += entity.y;

          if (entity.gameObject.collider.radius) {
            collider.strokeCircle(collision.x, collision.y, collision.radius);
            collider.fillCircle(collision.x, collision.y, collision.radius);
          } else {
            collider.strokeRect(collision.x, collision.y, collision.w, collision.h);
            collider.fillRect(collision.x, collision.y, collision.w, collision.h);
          }
        }
      });
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
    this.mode = mode;

    // Clear preview on leaving editor
    if (mode === undefined) {
      this.clearCopyPasteMode();
      clearLastPreviewTiles();
    }
  },

  shutdown() {
    hotkeys.unbind('e', scopes.player);
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
  },
});
