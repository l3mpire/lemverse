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
  hotkeys('command+z', { scope: 'editor-menu' }, event => {
    event.preventDefault();
    game.scene.keys.EditorScene.undo();
  });
  hotkeys('shift+command+z', { scope: 'editor-menu' }, event => {
    event.preventDefault();
    game.scene.keys.EditorScene.redo();
  });
  hotkeys('0', () => Session.set('selectedTiles', { index: -1, scope: 'editor-menu' }));
  hotkeys('1', () => Session.set('selectedTiles', { index: -2, scope: 'editor-menu' }));
  hotkeys('2', () => Session.set('selectedTiles', { index: -3, scope: 'editor-menu' }));
  hotkeys('3', () => Session.set('selectedTiles', { index: -4, scope: 'editor-menu' }));
  hotkeys('4', () => Session.set('selectedTiles', { index: -5, scope: 'editor-menu' }));
  hotkeys('5', () => Session.set('selectedTiles', { index: -6, scope: 'editor-menu' }));
  hotkeys('6', () => Session.set('selectedTiles', { index: -7, scope: 'editor-menu' }));
  hotkeys('7', () => Session.set('selectedTiles', { index: -8, scope: 'editor-menu' }));
  hotkeys('8', () => Session.set('selectedTiles', { index: -9, scope: 'editor-menu' }));
  hotkeys('c', () => Session.set('selectedTiles', { index: -99, scope: 'editor-menu' }));
};

const unbindKeyboardShortcuts = () => {
  hotkeys.unbind('command+z');
  hotkeys.unbind('shift+command+z');
  for (let i = 0; i < 8; i++) hotkeys.unbind(i.toString());
  hotkeys.unbind('c');
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
