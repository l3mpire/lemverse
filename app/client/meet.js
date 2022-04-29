// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe

let linkedZoneId;

const onZoneEntered = e => {
  const user = Meteor.user();
  if (user.profile.guest) return;

  const { roomName, fullscreen, unmute, unhide, shareScreen, jitsiLowLevel, _id } = e.detail.zone;
  const meet = jitsiLowLevel ? meetLowLevel : meetHighLevel;

  if (!meet.api && roomName) {
    userManager.saveMediaStates();
    Meteor.call('computeRoomName', _id, (err, data) => {
      if (err) { lp.notif.error('You cannot access this zone'); return; }
      meet.open(data);
      linkedZoneId = _id;
    });
  }

  if (meet.api) {
    toggleUserProperty('shareAudio', unmute || false);
    toggleUserProperty('shareVideo', unhide || false);
    toggleUserProperty('shareScreen', shareScreen || false);

    meet.fullscreen(fullscreen);
  }

  if (roomName) updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
};

const onZoneLeft = e => {
  const { zone, newZone } = e.detail;
  const { _id, jitsiLowLevel } = zone;

  if (linkedZoneId === _id) {
    const meet = jitsiLowLevel ? meetLowLevel : meetHighLevel;
    meet.close();

    userManager.clearMediaStates();
    updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
  }

  if (meet.api) {
    const { unmute, unhide, shareScreen, fullscreen } = newZone;

    toggleUserProperty('shareAudio', unmute || false);
    toggleUserProperty('shareVideo', unhide || false);
    toggleUserProperty('shareScreen', shareScreen || false);

    meet.fullscreen(fullscreen);
  }
};

window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
window.addEventListener(eventTypes.onZoneLeft, onZoneLeft);

meetHighLevel = {
  api: undefined,
  node: undefined,

  open(roomName = Meteor.settings.public.meet.roomDefaultName) {
    if (meet.api) return;

    const user = Meteor.user();
    const currentZone = zones.currentZone();

    const options = {
      roomName: kebabCase(roomName),
      width: '100%',
      height: '100%',
      parentNode: this.nodeElement(),
      userInfo: {
        email: user.emails[0].address,
        displayName: user.profile.name,
      },
      configOverwrite: {
        startWithAudioMuted: !currentZone.unmute,
        startWithVideoMuted: !currentZone.unhide,
        disableTileView: !currentZone.unhide,
      },
    };

    meet.api = new window.JitsiMeetExternalAPI(Meteor.settings.public.meet.serverURL, options);
    meet.api.addEventListener('videoConferenceJoined', () => {
      const { shareAudio, shareVideo } = Meteor.user().profile;
      if (shareAudio) this.unmute();
      else this.mute();

      if (shareVideo) this.unhide();
      else this.hide();
    });
    this.show(true);

    peer.disable();

    if (window.electron) {
      const { setupScreenSharingRender } = window.electron.jitsiMeetElectronUtils;
      setupScreenSharingRender(meet.api);
    }
  },

  close() {
    meet.api?.dispose();
    meet.api = undefined;
    this.show(false);
    peer.enable();
  },

  show(value) {
    this.nodeElement().classList.toggle('show', !!value);
  },

  fullscreen(value) {
    this.nodeElement().classList.toggle('fullscreen', !!value);
  },

  mute() {
    meet.api.isAudioMuted().then(muted => {
      if (muted) return;
      meet.api.executeCommand('toggleVideo');
    });
  },

  unmute() {
    meet.api.isAudioMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleVideo');
    });
  },

  hide() {
    meet.api.isVideoMuted().then(muted => {
      if (muted) return;
      meet.api.executeCommand('toggleAudio');
    });
  },

  unhide() {
    meet.api.isVideoMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleAudio');
    });
  },

  shareScreen() {},

  unshareScreen() {},

  nodeElement() {
    if (!this.node) this.node = document.querySelector('#meet');
    return this.node;
  },

  userName(name) {
    meet.api.executeCommand('displayName', name);
  },
};

meet = meetHighLevel;
