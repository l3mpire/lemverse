//
// tilesetImg
//

Template.tileImg.helpers({
  tileset() { return Tilesets.findOne(this.tilesetId); },
  tileToTilesetX() {
    const tileset = Tilesets.findOne(this.tilesetId);
    if (!tileset) return 0;
    const tileX = this.index % (tileset.width / 16);
    return tileX * 16;
  },
  tileToTilesetY() {
    const tileset = Tilesets.findOne(this.tilesetId);
    if (!tileset) return 0;
    const tileY = (this.index / (tileset.width / 16) | 0);
    return tileY * 16;
  },
});

//
// tilesetToolbox
//

hotkeys('command+z', { scope: 'tileset-toolbox' }, event => {
  event.preventDefault();
  const { redoTiles, undoTiles } = game.scene.keys.WorldScene;
  if (undoTiles.length === 0) return;
  const tile = undoTiles.pop();

  const currentTile = Tiles.findOne(tile._id);
  if (tile.index === -1) {
    redoTiles.push(currentTile);
    Tiles.remove(tile._id);
  } else if (currentTile) {
    redoTiles.push(currentTile);
    Tiles.update(tile._id, { $set: tile });
  } else {
    redoTiles.push({ _id: tile._id, index: -1 });
    Tiles.insert(tile);
  }
});
hotkeys('shift+command+z', { scope: 'tileset-toolbox' }, event => {
  event.preventDefault();
  const { redoTiles, undoTiles } = game.scene.keys.WorldScene;
  if (redoTiles.length === 0) return;
  const tile = redoTiles.pop();

  const currentTile = Tiles.findOne(tile._id);
  if (tile.index === -1) {
    undoTiles.push(currentTile);
    Tiles.remove(tile._id);
  } else if (currentTile) {
    undoTiles.push(currentTile);
    Tiles.update(tile._id, { $set: tile });
  } else {
    Tiles.insert(tile);
    undoTiles.push({ _id: tile._id, index: -1 });
  }
});
hotkeys('0', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -1, scope: 'tileset-toolbox' });
});
hotkeys('1', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -2, scope: 'tileset-toolbox' });
});
hotkeys('2', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -3, scope: 'tileset-toolbox' });
});
hotkeys('3', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -4, scope: 'tileset-toolbox' });
});
hotkeys('4', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -5, scope: 'tileset-toolbox' });
});
hotkeys('5', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -6, scope: 'tileset-toolbox' });
});
hotkeys('6', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -7, scope: 'tileset-toolbox' });
});
hotkeys('7', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -8, scope: 'tileset-toolbox' });
});
hotkeys('8', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -9, scope: 'tileset-toolbox' });
});
hotkeys('c', event => {
  event.preventDefault();
  Session.set('selectedTiles', { index: -99, scope: 'tileset-toolbox' });
});

Template.tilesetToolbox.onCreated(() => {
  game.scene.keys.WorldScene.render.disableAutoPause(true);
  game.scene.keys.WorldScene.render.resume();
  hotkeys.setScope('tileset-toolbox');
  Session.set('editor', 1);

  if (!Session.get('selectedTilesetId')) {
    const firstTileset = Tilesets.findOne({}, { sort: { name: 1 } });
    Session.set('selectedTilesetId', firstTileset);
  }
});

Template.tilesetToolbox.onDestroyed(() => {
  game.scene.keys.WorldScene.render.disableAutoPause(false);
  hotkeys.setScope('player');
});

Template.tilesetToolbox.helpers({
  pointerTile() {
    const pointerX = Session.get('pointerX');
    const pointerY = Session.get('pointerY');
    const x = game?.scene.keys.WorldScene.map.worldToTileX(pointerX);
    const y = game?.scene.keys.WorldScene.map.worldToTileY(pointerY);
    return Tiles.find({ x, y });
  },
  user(userId) { return Meteor.users.findOne(userId); },
  email() { return this?.emails?.[0]?.address; },
  selectedTilesIndex() { return Session.get('selectedTiles')?.index; },
  selectedTilesId() { return Session.get('selectedTilesetId'); },
});

Template.tilesetToolbox.events({
  'mousedown img'(event) {
    event.preventDefault();
    event.stopPropagation();
    const x = (event.offsetX / (16 * zoom)) | 0;
    const y = (event.offsetY / (16 * zoom)) | 0;
    const index = y * selectedTileset().width / 16 + x;
    Session.set('selectedTiles', { tilesetId: selectedTileset()._id, index, x, y, w: 1, h: 1, down: true });
    return false;
  },
  'mouseup img'() {
    const selectedTiles = Session.get('selectedTiles');
    if (selectedTiles.down) {
      selectedTiles.down = false;
      Session.set('selectedTiles', selectedTiles);
    }
  },
  'mousemove img'(event) {
    const x = (event.offsetX / (16 * zoom)) | 0;
    const y = ((event.offsetY) / (16 * zoom)) | 0;
    const index = y * selectedTileset().width / 16 + x;
    Session.set('pointerTileIndex', index);

    const selectedTiles = Session.get('selectedTiles');
    if (selectedTiles?.down) {
      selectedTiles.w = x - selectedTiles.x + 1;
      selectedTiles.h = y - selectedTiles.y + 1;
      Session.set('selectedTiles', selectedTiles);
    }
  },
  'click .js-erase-0'() {
    Session.set('selectedTiles', { index: -1 });
    return false;
  },
  'click .js-erase-1'() {
    Session.set('selectedTiles', { index: -2 });
    return false;
  },
  'click .js-erase-2'() {
    Session.set('selectedTiles', { index: -3 });
    return false;
  },
  'click .js-erase-3'() {
    Session.set('selectedTiles', { index: -4 });
    return false;
  },
  'click .js-erase-4'() {
    Session.set('selectedTiles', { index: -5 });
    return false;
  },
  'click .js-erase-5'() {
    Session.set('selectedTiles', { index: -6 });
    return false;
  },
  'click .js-erase-6'() {
    Session.set('selectedTiles', { index: -7 });
    return false;
  },
  'click .js-erase-7'() {
    Session.set('selectedTiles', { index: -8 });
    return false;
  },
  'click .js-erase-8'() {
    Session.set('selectedTiles', { index: -9 });
    return false;
  },
  'click .js-erase-all'() {
    Session.set('selectedTiles', { index: -99 });
    return false;
  },
  'change .js-tilesets-select'(event) {
    Session.set('selectedTilesetId', event.target.value);
    $('.tileset-toolbox-img')[0].scrollTop = 0;
    $('.tileset-toolbox-img')[0].scrollLeft = 0;
  },
});
