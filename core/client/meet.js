// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe

let linkedZoneId;

const updateMeetStates = zone => {
  const { unmute, unhide, shareScreen } = zone;

  toggleUserProperty('shareAudio', unmute || false);
  toggleUserProperty('shareVideo', unhide || false);
  toggleUserProperty('shareScreen', shareScreen || false);
};

const onZoneEntered = e => {
  const user = Meteor.user();
  if (user.profile.guest) return;

  const { zone } = e.detail;
  const { _id, roomName, fullscreen, jitsiLowLevel } = zone;
  meet = jitsiLowLevel ? meetLowLevel : meetHighLevel;

  if (!meet.api && roomName) {
    userManager.saveMediaStates();
    Meteor.call('computeRoomName', _id, (err, data) => {
      if (err) { lp.notif.error('You cannot access this zone'); return; }
      if (!data) { lp.notif.error('Unable to load a room, please try later'); return; }

      meet.open(data);
      linkedZoneId = _id;
      updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
      updateMeetStates(zone);
      meet.fullscreen(fullscreen);
      Meteor.call('analyticsConferenceAttend', { zoneId: _id, zoneName: roomName });
    });
  } else if (meet.api) updateMeetStates(zone);
};

const onZoneLeft = e => {
  const { zone, newZone } = e.detail;
  const { _id, jitsiLowLevel, roomName } = zone;

  if (linkedZoneId === _id) {
    meet = jitsiLowLevel ? meetLowLevel : meetHighLevel;
    meet.close();
    Meteor.call('analyticsConferenceEnd', { zoneId: _id, zoneName: roomName });
    linkedZoneId = undefined;

    userManager.clearMediaStates();
    updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
    meet.fullscreen(false);
  }

  if (meet.api && newZone) updateMeetStates(newZone);
};

const onZoneUpdated = e => {
  if (!linkedZoneId) return;

  const { zone } = e.detail;
  const currentZone = zones.currentZone(Meteor.user());
  if (currentZone._id !== linkedZoneId) return;

  meet.fullscreen(zone.fullscreen);
  const screenMode = zone.fullscreen ? viewportModes.small : viewportModes.splitScreen;
  updateViewport(game.scene.keys.WorldScene, screenMode);
};

window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
window.addEventListener(eventTypes.onZoneLeft, onZoneLeft);
window.addEventListener(eventTypes.onZoneUpdated, onZoneUpdated);
window.addEventListener('load', () => {
  const head = document.querySelector('head');

  const script = document.createElement('script');
  script.src = `https://${Meteor.settings.public.meet.serverURL}/external_api.js`;
  head.appendChild(script);

  const scriptLowLevel = document.createElement('script');
  scriptLowLevel.src = `https://${Meteor.settings.public.meet.serverURL}/libs/lib-jitsi-meet.min.js`;
  head.appendChild(scriptLowLevel);
});

hotkeys('f', { scope: scopes.player }, event => {
  if (event.repeat || !linkedZoneId) return;
  event.preventDefault();

  if (!isEditionAllowed(Meteor.userId())) return;

  const zone = Zones.findOne(linkedZoneId);
  if (zone) zones.setFullscreen(zone, !zone.fullscreen);
});

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
      meet.api.executeCommand('toggleAudio');
    });
  },

  unmute() {
    meet.api.isAudioMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleAudio');
    });
  },

  hide() {
    meet.api.isVideoMuted().then(muted => {
      if (muted) return;
      meet.api.executeCommand('toggleVideo');
    });
  },

  unhide() {
    meet.api.isVideoMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleVideo');
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
