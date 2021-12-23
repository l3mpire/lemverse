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

const entityTooltipConfig = {
  identifier: 'nearest-entity',
  proximityRequired: 150 ** 2, // Distance without using sqrt
  text: 'Press the key <b>u</b> to use',
  style: 'tooltip with-arrow fade-in',
};

entityManager = {
  entities: [],
  scene: undefined,
  firstEntity: undefined,
  enable_path_coloration: false,
  current_cell: 0,
  previousTile: undefined,
  previousNearestEntity: undefined,
  enable_sync_coloration: false,

  init(scene) {
    this.scene = scene;
  },

  create() { },

  remove() { },

  update(entity) {
    if (entity.name === 'room-4-ready') Session.set('showScoreInterface', !entity.state);
  },

  onInteraction(tiles, interactionPosition) {
    const { levelId } = Meteor.user().profile;
    const entities = Entities.find().fetch();

    entities.forEach(entity => {
      if (this.isEntityTriggered(entity, interactionPosition)) Meteor.call('switchEntityState', levelId, entity.name);
    });
  },

  isEntityTriggered(entity, position) {
    const area = entity.triggerArea;
    if (!area) return false;

    if (position.x < entity.x + area.x) return false;
    if (position.x > entity.x + area.x + area.w) return false;
    if (position.y < entity.y + area.y) return false;
    if (position.y > entity.y + area.y + area.h) return false;

    return true;
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

    const { player } = userManager;
    if (player) this.handleNearestEntityTooltip(player);
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
        const tile = levelManager.map.getTileAt(i, j, false, 0);
        if (tile) tile.tint = 0xFFFFFF;
      }
    }

    this.previousTile = undefined;
    userManager.teleportMainUser(failTeleportTile.x, failTeleportTile.y);
  },

  handleNearestEntityTooltip(position) {
    let nearestEntity = this.nearestEntity(position);
    if (nearestEntity && this.entityDistanceTo(nearestEntity, position) >= entityTooltipConfig.proximityRequired) nearestEntity = undefined;

    if (nearestEntity) {
      if (!this.previousNearestEntity) {
        characterPopIns.createOrUpdate(
          entityTooltipConfig.identifier,
          entityTooltipConfig.text,
          { target: nearestEntity, className: entityTooltipConfig.style },
        );
      }

      characterPopIns.popIns[entityTooltipConfig.identifier].setData('target', nearestEntity);
      this.previousNearestEntity = nearestEntity;
    } else if (this.previousNearestEntity) {
      characterPopIns.destroyPopIn(entityTooltipConfig.identifier);
      this.previousNearestEntity = undefined;
    }
  },

  nearestEntity(position) {
    const entities = Entities.find().fetch();
    let nearestEntity;
    let previousDistance = Infinity;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const distance = this.entityDistanceTo(entity, position);
      if (distance < previousDistance) {
        nearestEntity = entity;
        previousDistance = distance;
      }
    }

    return nearestEntity;
  },

  entityDistanceTo(entity, position) {
    return (position.x - entity.x) ** 2 + (position.y - entity.y) ** 2;
  },
};
