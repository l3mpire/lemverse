const iframeAllowAttributeSettings = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const getZoneCenter = zone => [(zone.x1 + zone.x2) * 0.5, (zone.y1 + zone.y2) * 0.5];

zones = {
  activeZone: undefined,
  toastTimerInstance: undefined,
  toastBloc: undefined,
  webpageContainer: undefined,
  webpageIframeContainer: undefined,

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

    const queryOption = includeCurrentUser ? {} : { _id: { $ne: Meteor.userId() } };
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

  toastZoneName(zoneName) {
    if (!this.toastBloc) this.toastBloc = $('.zone-name-toaster');

    if (zoneName) {
      this.toastBloc.text(zoneName);
      this.toastBloc.addClass('show');
    }

    clearTimeout(this.toastTimerInstance);
    this.toastTimerInstance = setTimeout(() => this.toastBloc.removeClass('show'), 1500);
  },

  checkDistances(player) {
    if (!player) return;

    // check if we are in a new zone
    const availableZones = Zones.find({
      x1: { $lte: player.x },
      x2: { $gte: player.x },
      y1: { $lte: player.y },
      y2: { $gte: player.y },
    }).fetch();

    const zone = _.reduce(availableZones, (mz, z) => {
      if (mz.name) mz.name = `${mz.name} | ${z.name}`;
      else mz.name = z.name;

      _.each(_.keys(z), k => {
        if (k === 'name') return;
        if (z[k]) mz[k] = z[k];
      });
      return mz;
    }, {});

    if (this.activeZone?._id !== zone._id) {
      // notify about zone change
      if (!_.isEmpty(this.activeZone)) {
        const zoneLeavedEvent = new CustomEvent(eventTypes.onZoneLeaved, { detail: { zone: this.activeZone } });
        window.dispatchEvent(zoneLeavedEvent);
      }

      if (!_.isEmpty(zone)) {
        const zoneEnteredEvent = new CustomEvent(eventTypes.onZoneEntered, { detail: { zone, previousZone: this.activeZone } });
        window.dispatchEvent(zoneEnteredEvent);
      }

      this.activeZone = zone;
      if (zone.name && !zone.hideName) this.toastZoneName(zone.name);

      if (zone.url) {
        this.getIframeElement().src = zone.url;
        if (zone.yt) this.getIframeElement().allow = iframeAllowAttributeSettings;
        this.getWebpageElement().classList.add('show');
      } else if (!zone.url && !meet.api) {
        this.getIframeElement().src = '';
        this.getWebpageElement().classList.remove('show');
      }

      const user = Meteor.users.findOne(player.userId);
      if (!user) return;

      if (!this.isUserAllowed(user, zone)) {
        const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
        userManager.teleportMainUser(+x, +y);
        lp.notif.error('This zone is reserved');

        return;
      }

      if (zone.adminOnly && !user.roles?.admin && !user.profile.guest) {
        const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
        userManager.teleportMainUser(+x, +y);
        lp.notif.error('This zone is reserved');
      }

      if (meet.api && !zone.roomName) {
        meet.close();
        userManager.clearMediaStates();
      } else if (!meet.api && zone.roomName && !user.profile.guest) {
        userManager.saveMediaStates();
        meet.open(`${zone.levelId}-${zone.roomName}`);
      }

      if (meet.api) {
        toggleUserProperty('shareAudio', zone.unmute || false);
        toggleUserProperty('shareVideo', zone.unhide || false);

        meet.fullscreen(zone.fullscreen);
      }
    }
  },

  isUserAllowed(user, zone) {
    if (zone.adminOnly && !user.roles?.admin) return false;

    if (zone.requiredItems?.length) {
      if (user.profile.guest) return false;

      const userItems = Object.keys(user.inventory || []);
      return zone.requiredItems.every(tag => userItems.includes(tag));
    }

    return true;
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
