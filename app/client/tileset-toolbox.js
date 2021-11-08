const copyToClipboard = value => {
  navigator.clipboard.writeText(value)
    .then(() => lp.notif.success('Tiles data copied to the clipboard'))
    .catch(() => lp.notif.error('Unable to copy tiles to the clipboard'));
};

const pointerToTile = () => {
  const pointerX = Session.get('pointerX');
  const pointerY = Session.get('pointerY');
  const x = levelManager.map.worldToTileX(pointerX);
  const y = levelManager.map.worldToTileY(pointerY);

  return Tiles.find({ x, y });
};

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
const bindKeyboardShortcuts = () => {
  hotkeys('command+z', { scope: scopes.editor }, event => {
    event.preventDefault();
    game.scene.keys.EditorScene.undo();
  });
  hotkeys('shift+command+z', { scope: scopes.editor }, event => {
    event.preventDefault();
    game.scene.keys.EditorScene.redo();
  });
  hotkeys('ctrl+c, cmd+c', { scope: scopes.editor }, event => {
    event.preventDefault();

    const tiles = pointerToTile().fetch();
    if (!tiles.length) return;
    copyToClipboard(JSON.stringify(tiles, null, 2));
  });
  hotkeys('0', () => Session.set('selectedTiles', { index: -1, scope: scopes.editor }));
  hotkeys('1', () => Session.set('selectedTiles', { index: -2, scope: scopes.editor }));
  hotkeys('2', () => Session.set('selectedTiles', { index: -3, scope: scopes.editor }));
  hotkeys('3', () => Session.set('selectedTiles', { index: -4, scope: scopes.editor }));
  hotkeys('4', () => Session.set('selectedTiles', { index: -5, scope: scopes.editor }));
  hotkeys('5', () => Session.set('selectedTiles', { index: -6, scope: scopes.editor }));
  hotkeys('6', () => Session.set('selectedTiles', { index: -7, scope: scopes.editor }));
  hotkeys('7', () => Session.set('selectedTiles', { index: -8, scope: scopes.editor }));
  hotkeys('8', () => Session.set('selectedTiles', { index: -9, scope: scopes.editor }));
  hotkeys('c', () => Session.set('selectedTiles', { index: -99, scope: scopes.editor }));
};

const unbindKeyboardShortcuts = () => {
  hotkeys.unbind('command+z', scopes.editor);
  hotkeys.unbind('shift+command+z', scopes.editor);
  hotkeys.unbind('ctrl+c, cmd+c', scopes.editor);
  for (let i = 0; i < 8; i++) hotkeys.unbind(i.toString(), scopes.editor);
  hotkeys.unbind('c', scopes.editor);
};

Template.tilesetToolbox.onCreated(() => {
  bindKeyboardShortcuts();

  if (!Session.get('selectedTilesetId')) {
    const firstTileset = Tilesets.findOne({}, { sort: { name: 1 } });
    Session.set('selectedTilesetId', firstTileset);
  }
});

Template.tilesetToolbox.onDestroyed(() => {
  unbindKeyboardShortcuts();
});

Template.tileData.helpers({
  hasCollision(tilesetId, index) {
    const tileset = Tilesets.findOne(tilesetId);
    return tileset.collisionTileIndexes.includes(index); 
  },
});

Template.tilesetToolbox.helpers({
  pointerTile() { return pointerToTile(); },
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
