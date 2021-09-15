zones = {
  activeZone: undefined,
  onZoneChanged: undefined,
  toastTimerInstance: undefined,
  toastBloc: undefined,

  currentZone(user) {
    return Zones.findOne({
      x1: { $lte: user.profile.x },
      x2: { $gte: user.profile.x },
      y1: { $lte: user.profile.y },
      y2: { $gte: user.profile.y },
    });
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

  usersInZone(zone) {
    if (!zone) return [];

    const users = Meteor.users.find({ _id: { $ne: Meteor.userId() } }).fetch();
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
      this.toastBloc.text(`You are entering: ${zoneName}`);
      this.toastBloc.addClass('show');
    }

    clearTimeout(this.toastTimerInstance);
    this.toastTimerInstance = setTimeout(() => this.toastBloc.removeClass('show'), 1500);
  },

  checkDistances() {
    const { player } = game?.scene?.keys?.WorldScene || {};
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

    if (this.activeZone?.name !== zone?.name) {
      if (this.onZoneChanged && this.activeZone?._id !== zone?._id) this.onZoneChanged(!_.isEmpty(zone) ? zone : undefined, this.activeZone);
      this.activeZone = zone;
      this.toastZoneName(zone?.name);

      const dataPlayer = Meteor.users.findOne({ _id: player.userId });

      if (zone?.adminOnly && !dataPlayer?.roles?.admin && !dataPlayer.profile?.guest) {
        const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
        game.scene.keys.WorldScene.player.x = +x;
        game.scene.keys.WorldScene.player.y = +y;
        savePlayer(game.scene.keys.WorldScene.player);
        lp.notif.error('This zone is reserved for admin')
      }

      if (meet.api && !zone?.roomName) {
        meet.close();
      } else if (!meet.api && zone?.roomName && !dataPlayer.profile?.guest) {
        meet.open(zone.roomName);
      }

      if (meet.api) {
        if (zone?.unmute) {
          meet.unmute();
        } else {
          meet.mute();
        }

        if (zone?.unhide) {
          meet.unhide();
        } else {
          meet.hide();
        }

        if (zone?.fullscreen) {
          meet.fullscreen(true);
        } else {
          meet.fullscreen(false);
        }
      }

      if (zone?.url) {
        $('#webpageIframe').attr('src', zone.url);
        $('#webpage').addClass('show');
      } else if ((!zone || !zone.url) && !meet?.api) {
        $('#webpageIframe').attr('src', '');
        $('#webpage').removeClass('show');
      }
    }
  },
};
