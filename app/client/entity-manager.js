const roomFourPath = [
  [80, 40],
  [81, 40],
  [82, 40],
  [83, 40],
  [83, 39],
  [83, 38],
  [83, 37],
  [84, 37],
  [85, 37],
  [85, 38],
  [85, 39],
  [85, 40],
  [85, 41],
  [85, 42],
  [86, 42],
  [87, 42],
  [88, 42],
  [88, 41],
  [89, 41],
];

const failTeleportTile = { x: 3721, y: 1908 };

entityManager = {
  entities: [],
  scene: undefined,
  firstEntity: undefined,
  enable_path_coloration: false,
  current_cell: 0,
  previousTile: undefined,
  enable_sync_coloration: false,

  init(scene) {
    this.scene = scene;
  },

  create() { },

  remove() { },

  update(entity) {
    if (entity.name === 'room-4-ready') Session.set('showPaintInterface', !entity.state);
  },

  onInteraction(tile) {
    const { levelId } = Meteor.user().profile;

    levelConfiguration.rooms.forEach(room => {
      room.entities.forEach(entity => {
        const isUsed = entity.coordinates.some(coordinate => tile.x === coordinate[0] && tile.y === coordinate[1]);
        if (isUsed) Meteor.call('switchEntityState', levelId, entity.name);
      });
    });
  },

  postUpdate() {
    if (this.enable_path_coloration || this.enable_sync_coloration) {
      const tiles = userManager.getTilesUnderPlayer(userManager.player, [0]);

      if (tiles.length) {
        if (this.enable_path_coloration) tiles.forEach(tile => { tile.tint = 0x00AA00; });

        const currentTile = tiles[0];
        let changedTile = false;
        if (this.previousTile) {
          if (this.previousTile.x !== currentTile.x || this.previousTile.y !== currentTile.y) changedTile = true;
        }

        if (changedTile) this.onTileUnderPlayerChanged(currentTile, this.previousTile);
        this.previousTile = tiles[0];
      }
    }
  },

  onTileUnderPlayerChanged(tile) {
    if (this.enable_path_coloration) {
      const exists = roomFourPath.find(t => tile.x === t[0] && tile.y === t[1]);
      if (!exists) this.onFailed();
    } else if (this.enable_sync_coloration) {
      this.paintTile(tile);
    }
  },

  paintTile(tile) {
    const { levelId } = Meteor.user().profile;
    const index = tile.index - tile.tileset.firstgid;
    setTimeout(() => {
      Meteor.call('paintTile', levelId, tile.x, tile.y, index);
    }, 0);
  },

  onFailed() {
    for (let i = 80; i <= 89; i++) {
      for (let j = 32; j <= 48; j++) {
        const tile = userManager.scene.map.getTileAt(i, j, false, 0);
        if (tile) tile.tint = 0xFFFFFF;
      }
    }

    this.previousTile = undefined;
    userManager.teleportMainUser(failTeleportTile.x, failTeleportTile.y);
  },
};
