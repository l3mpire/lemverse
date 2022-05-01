const iframeAllowAttributeSettings = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const getZoneCenter = zone => [(zone.x1 + zone.x2) * 0.5, (zone.y1 + zone.y2) * 0.5];

const newContentAnimation = { duration: 250, ease: 'Cubic', yoyo: true, hold: 2000, repeat: -1 };
const zoneAnimations = {
  newContent: () => ({
    alpha: { ...newContentAnimation, value: 0.05 },
  }),
};

zones = {
  activeZone: undefined,
  previousAvailableZones: [],
  webpageContainer: undefined,
  webpageIframeContainer: undefined,
  newContentSprites: {},
  scene: undefined,

  init(scene) {
    this.scene = scene;
  },

  destroy() {
    this.newContentSprites = {};
  },

  onDocumentAdded(zone) {
    this.checkZoneForNewContent(zone);
    if (zone.popInConfiguration?.autoOpen) characterPopIns.initFromZone(zone);
  },

  onDocumentRemoved(zone) {
    this.destroyNewContentIndicator(zone);
  },

  onDocumentUpdated(newZone) {
    this.checkZoneForNewContent(newZone);

    const currentZone = zones.currentZone(Meteor.user());
    if (!currentZone || currentZone._id !== newZone._id) return;

    if (meet.api) {
      meet.fullscreen(newZone.fullscreen);
      const screenMode = newZone.fullscreen ? viewportModes.small : viewportModes.splitScreen;
      updateViewport(this.scene, screenMode);
    }
  },

  currentZone(user) {
    if (!user || user === Meteor.user()) return this.activeZone;

    const zones = this.currentZones(user);
    if (!zones.length) return undefined;

    return zones[0];
  },

  currentZones(user) {
    const zones = Zones.find({
      x1: { $lte: user.profile.x },
      x2: { $gte: user.profile.x },
      y1: { $lte: user.profile.y },
      y2: { $gte: user.profile.y },
    }).fetch();

    if (!zones.length) return [];

    return this.sortByNearest(zones, user.profile.x, user.profile.y);
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

  openZoneURL(zone) {
    this.getIframeElement().src = zone.url;
    if (zone.yt) this.getIframeElement().allow = iframeAllowAttributeSettings;
    this.getWebpageElement().classList.add('show');

    updateViewport(game.scene.keys.WorldScene, zone.fullscreen ? viewportModes.small : viewportModes.splitScreen);
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

    const availableZones = Zones.find({
      x1: { $lte: player.x },
      x2: { $gte: player.x },
      y1: { $lte: player.y },
      y2: { $gte: player.y },
    }).fetch();

    // todo: check if both arrays have same values
    const hasChangedZone = availableZones.length !== this.previousAvailableZones.length;
    if (!hasChangedZone) return;

    const availableZonesId = availableZones.map(zone => zone._id);
    const previousAvailableZonesId = this.previousAvailableZones.map(zone => zone._id);
    const zonesLeft = this.previousAvailableZones.filter(zone => !availableZonesId.includes(zone._id));
    const zonesEntered = availableZones.filter(zone => !previousAvailableZonesId.includes(zone._id));

    let activeZone;
    if (zonesEntered.length) activeZone = zonesEntered[zonesEntered.length - 1];
    else if (this.activeZone && !availableZonesId.includes(this.activeZone._id)) activeZone = availableZones[availableZones.length - 1];
    this.setActiveZone(activeZone);

    // compute zone toaster
    if (activeZone && !activeZone.hideName) {
      const zone = _.reduce(availableZones, (mz, z) => {
        if (mz.name) mz.name = `${mz.name} | ${z.name}`;
        else mz.name = z.name;
        _.each(_.keys(z), k => {
          if (k === 'name') return;
          if (z[k]) mz[k] = z[k];
        });
        return mz;
      }, {});

      Session.set('showZoneName', zone);
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
    if (!zone) return;

    const user = Meteor.user();
    if (!user) return;

    if (!userAllowedInZone(user, zone)) {
      const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
      userManager.teleportMainUser(+x, +y);
      lp.notif.error('This zone is reserved');
    }
  },

  closeIframeElement() {
    this.getIframeElement().src = '';
    this.getWebpageElement().classList.remove('show');
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

    const { zoneLastSeenDates } = Meteor.user();
    if (!zoneLastSeenDates) return false;

    return zoneLastSeenDates[zone._id] < zone.lastMessageAt;
  },

  getIframeElement() {
    if (!this.webpageIframeContainer) this.webpageIframeContainer = document.querySelector('#webpageIframe');
    return this.webpageIframeContainer;
  },

  getWebpageElement() {
    if (!this.webpageContainer) this.webpageContainer = document.querySelector('#webpage');
    return this.webpageContainer;
  },
};
