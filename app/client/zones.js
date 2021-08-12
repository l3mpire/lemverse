zones = {
  currentZoneName: undefined,
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

    if (this.currentZoneName !== zone?.name) {
      if (this.onZoneChanged) this.onZoneChanged(!_.isEmpty(zone) ? zone : undefined);
      this.currentZoneName = zone?.name;
      this.toastZoneName(zone?.name);

      const dataPlayer = Meteor.users.findOne({ _id: player.userId });

      if (zone?.adminOnly && !dataPlayer?.roles?.admin && !dataPlayer.profile?.guest) {
        const [x, y] = zone.teleportEndpoint ? zone.teleportEndpoint.split(',') : [73, 45];
        game.scene.keys.WorldScene.player.x = +x;
        game.scene.keys.WorldScene.player.y = +y;
        savePlayer(game.scene.keys.WorldScene.player);
        notificationMessage = 'This zone is reserved for admin';
        Session.set('displayNotification', true);
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
