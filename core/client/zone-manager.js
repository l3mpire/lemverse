import { canAccessZone } from '../lib/misc';

const getZoneCenter = zone => [(zone.x1 + zone.x2) * 0.5, (zone.y1 + zone.y2) * 0.5];

const newContentAnimation = { duration: 250, ease: 'Cubic', yoyo: true, hold: 2000, repeat: -1 };
const zoneAnimations = {
  newContent: () => ({
    alpha: { ...newContentAnimation, value: 0.05 },
  }),
};

const teleportUserOutsideZone = zone => {
  const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
  userManager.teleportMainUser(+x, +y);
};

zoneManager = {
  activeZone: undefined,
  previousAvailableZones: [],
  newContentSprites: {},
  scene: undefined,
  zones: [],

  init(scene) {
    this.scene = scene;
  },

  destroy() {
    this.newContentSprites = {};
    this.zones = [];
  },

  onDocumentAdded(zone) {
    this.checkZoneForNewContent(zone);
    this.refreshZoneList();
    if (zone.popInConfiguration?.autoOpen) characterPopIns.initFromZone(zone);
    window.dispatchEvent(new CustomEvent(eventTypes.onZoneAdded, { detail: { zone } }));
  },

  onDocumentRemoved(zone) {
    this.destroyNewContentIndicator(zone);
    this.refreshZoneList();
    window.dispatchEvent(new CustomEvent(eventTypes.onZoneRemoved, { detail: { zone } }));
  },

  onDocumentUpdated(zone) {
    this.checkZoneForNewContent(zone);
    this.refreshZoneList();
    window.dispatchEvent(new CustomEvent(eventTypes.onZoneUpdated, { detail: { zone } }));
  },

  currentZone(user) {
    if (!user || user._id === Meteor.userId()) return this.activeZone;

    const zones = this.findZonesForPosition({ x: user.profile.x, y: user.profile.y });
    if (!zones.length) return undefined;

    const sortedZones = this.sortByNearest(zones, user.profile.x, user.profile.y);
    return sortedZones[0];
  },

  setFullscreen(zone, value) {
    Zones.update(zone._id, { $set: { fullscreen: !!value } });
  },

  getCenter(zone) {
    return {
      x: zone.x1 + (zone.x2 - zone.x1) / 2,
      y: zone.y1 + (zone.y2 - zone.y1) / 2,
    };
  },

  sortByNearest(zones, x, y) {
    // todo: sort using square edges or polygons
    return zones.sort((zoneA, zoneB) => {
      const zoneAPosition = getZoneCenter(zoneA);
      const zoneBPosition = getZoneCenter(zoneB);
      const zoneADistance = (zoneAPosition[0] - x) ** 2 + (zoneAPosition[1] - y) ** 2;
      const zoneBDistance = (zoneBPosition[0] - x) ** 2 + (zoneBPosition[1] - y) ** 2;

      return zoneADistance - zoneBDistance;
    });
  },

  computePositionFromString(zone, positionName) {
    const width = zone.x2 - zone.x1;
    const height = zone.y2 - zone.y1;

    switch (positionName) {
      case 'top':
        return {
          x: zone.x1 + width / 2,
          y: zone.y1,
        };
      case 'bottom':
        return {
          x: zone.x1 + width / 2,
          y: zone.y2,
        };
      case 'left':
        return {
          x: zone.x1,
          y: zone.y1 + height / 2,
        };
      case 'right':
        return {
          x: zone.x2,
          y: zone.y1 + height / 2,
        };
      default:
        break;
    }

    return this.getCenter(zone);
  },

  isUserInSameZone(userA, userB) {
    return this.currentZone(userA)?._id === this.currentZone(userB)?._id;
  },

  usersInZone(zone, includeCurrentUser = false) {
    if (!zone) return [];

    const queryOption = { 'status.online': true, 'profile.levelId': zone.levelId };
    if (!includeCurrentUser) queryOption._id = { $ne: Meteor.userId() };
    const users = Meteor.users.find(queryOption).fetch();

    const usersInZone = [];
    _.each(users, user => {
      const { x, y } = user.profile;
      if (x < zone.x1) return;
      if (x > zone.x2) return;
      if (y < zone.y1) return;
      if (y > zone.y2) return;

      usersInZone.push(user);
    });

    return usersInZone;
  },

  checkDistances(player) {
    if (!player) return;

    const availableZones = this.findZonesForPosition({ x: player.x, y: player.y });

    if (availableZones.length === this.previousAvailableZones.length && availableZones.every((zone, i) => zone._id === this.previousAvailableZones[i]._id)) return;

    const availableZonesId = availableZones.map(zone => zone._id);
    const previousAvailableZonesId = this.previousAvailableZones.map(zone => zone._id);
    const zonesLeft = this.previousAvailableZones.filter(zone => !availableZonesId.includes(zone._id));
    const zonesEntered = availableZones.filter(zone => !previousAvailableZonesId.includes(zone._id));

    let activeZone;
    if (zonesEntered.length) activeZone = zonesEntered[zonesEntered.length - 1];
    else if (this.activeZone && !availableZonesId.includes(this.activeZone._id)) activeZone = availableZones[availableZones.length - 1];

    // set as activate zone + check permissions
    if (!this.setActiveZone(activeZone)) {
      lp.notif.error('You cannot access this zone');
      teleportUserOutsideZone(activeZone);
      return;
    }

    // compute zone toaster
    if (activeZone && !activeZone.hideName) {
      const name = availableZones.map(z => z.name).filter(Boolean).join(' | ');
      Session.set('zoneToaster', { name, hasNewContent: this.hasNewContent(activeZone) });
    }

    // notify external modules
    zonesLeft.forEach(zone => {
      window.dispatchEvent(new CustomEvent(eventTypes.onZoneLeft, { detail: { zone, newZone: this.activeZone } }));
      sendEvent('zone-entered', { zone });
    });

    zonesEntered.forEach(zone => {
      window.dispatchEvent(new CustomEvent(eventTypes.onZoneEntered, { detail: { zone, previousZone: this.activeZone } }));
      sendEvent('zone-left', { zone });
    });

    this.previousAvailableZones = availableZones;
  },

  setActiveZone(zone) {
    this.activeZone = zone;
    if (!zone) return true;

    try {
      if (!canAccessZone(zone, Meteor.user())) throw new Error('access-denied');
    } catch (err) {
      this.activeZone = undefined;
      return false;
    }

    return true;
  },

  showNewContentIndicator(zone) {
    this.destroyNewContentIndicator(zone);

    // use the entity has an indicator, otherwise show an animated area
    if (zone.entityId) {
      const entity = Entities.findOne(zone.entityId);
      if (entity && entityManager.updateEntityFromState(entity, 'on')) return;
    }

    const position = this.getCenter(zone);
    const width = zone.x2 - zone.x1;
    const height = zone.y2 - zone.y1;

    const sprite = this.scene.add.sprite(position.x, position.y, 'pixel');
    sprite.setScale(width, height);
    sprite.alpha = 0.8;
    sprite.setTint(0xFFBB04);

    const tween = this.scene.tweens.add({
      targets: sprite,
      ...zoneAnimations.newContent(width, height),
    });

    this.newContentSprites[zone._id] = { sprite, tween };
  },

  destroyNewContentIndicator(zone) {
    // reset entity linked's state
    if (zone.entityId) {
      const entity = Entities.findOne(zone.entityId);
      if (entity) entityManager.updateEntityFromState(entity, 'off');
    }

    const newContentSprites = this.newContentSprites[zone._id];
    if (!newContentSprites) return;

    newContentSprites.sprite?.destroy();
    newContentSprites.tween?.stop();

    delete this.newContentSprites[zone._id];
  },

  checkZoneForNewContent(zone) {
    if (!this.hasNewContent(zone)) return;
    this.showNewContentIndicator(zone);
  },

  hasNewContent(zone) {
    if (!zone.lastMessageAt || Session.get('messagesChannel') === zone._id) return false;

    const user = Meteor.user({ fields: { zoneLastSeenDates: 1 } });
    if (!user) return false;

    const zoneLastSeenDates = user.zoneLastSeenDates || {};
    return zoneLastSeenDates[zone._id] < zone.lastMessageAt;
  },

  isInsideZone(zone, position) {
    if (position.x < zone.x1) return false;
    if (position.x > zone.x2) return false;
    if (position.y < zone.y1) return false;

    return position.y <= zone.y2;
  },

  findZonesForPosition(position) {
    const zones = [];
    this.getZones().forEach(zone => {
      if (!this.isInsideZone(zone, position)) return;
      zones.push(zone);
    });

    return zones;
  },

  refreshZoneList() {
    this.zones = Zones.find().fetch();
  },

  getZones() {
    return this.zones;
  },
};
