// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
import escapeStringRegexp from 'escape-string-regexp';

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
    Meteor.call('computeMeetRoomAccess', _id, (err, data) => {
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

window.addEventListener('load', () => {
  const head = document.querySelector('head');

  const script = document.createElement('script');
  script.src = `https://${Meteor.settings.public.meet.serverURL}/external_api.js`;
  head.appendChild(script);

  const scriptLowLevel = document.createElement('script');
  scriptLowLevel.src = `https://${Meteor.settings.public.meet.serverURL}/libs/lib-jitsi-meet.min.js`;
  head.appendChild(scriptLowLevel);

  hotkeys('f', { scope: scopes.player }, event => {
    if (event.repeat || !linkedZoneId) return;
    event.preventDefault();

    if (!isEditionAllowed(Meteor.userId())) return;

    const zone = Zones.findOne(linkedZoneId);
    if (zone) zones.setFullscreen(zone, !zone.fullscreen);
  });

  window.addEventListener(eventTypes.onZoneEntered, onZoneEntered);
  window.addEventListener(eventTypes.onZoneLeft, onZoneLeft);
  window.addEventListener(eventTypes.onZoneUpdated, onZoneUpdated);
});

meetHighLevel = {
  api: undefined,
  node: undefined,

  open(config) {
    if (meet.api) return;

    const user = Meteor.user();
    const currentZone = zones.currentZone();

    const options = {
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
      roomName: config.roomName,
      jwt: config.token,
    };

    meet.api = new window.JitsiMeetExternalAPI(Meteor.settings.public.meet.serverURL, options);
    meet.api.addEventListener('videoConferenceJoined', () => {
      const { shareAudio, shareVideo } = Meteor.user().profile;
      if (shareAudio) this.unmute();
      else this.mute();

      if (shareVideo) this.unhide();
      else this.hide();
    });

    meet.api.addEventListener('incomingMessage', event => {
      const { nick, message } = event;

      // We don't have a link between Jitsi and lemverse to identify the user at the moment. Waiting for the activation of the prosody plugin
      const userEmitter = Meteor.users.findOne({ 'profile.name': nick });
      if (!userEmitter) return;

      userManager.onPeerDataReceived({ emitter: userEmitter._id, data: this.convertActionToEmojis(message), type: 'text' });
    });

    this.show(true);

    peer.disable();

    if (window.electron) {
      const { setupScreenSharingRender } = window.electron.jitsiMeetElectronUtils;
      setupScreenSharingRender(meet.api);
    }
  },

  convertActionToEmojis(message) {
    // Taken from:
    // https://github.com/jitsi/jitsi-meet/blob/master/react/features/reactions/constants.ts#L113
    // https://github.com/jitsi/jitsi-meet/blob/master/react/features/chat/smileys.js
    const smileyToConvert = [
      { jitsi: ':thumbs_up:', emoji: '????' },
      { jitsi: ':clap:', emoji: '????' },
      { jitsi: ':grinning_face:', emoji: '????' },
      { jitsi: ':face_with_open_mouth:', emoji: '????' },
      { jitsi: ':slightly_frowning_face:', emoji: '????' },
      { jitsi: ':face_without_mouth:', emoji: '????' },
      { jitsi: ':)', emoji: '????' },
      { jitsi: ':(', emoji: '????' },
      { jitsi: ':D', emoji: '????' },
      { jitsi: ':+1:', emoji: '????' },
      { jitsi: ':P', emoji: '????' },
      { jitsi: ':wave:', emoji: '????' },
      { jitsi: ':blush:', emoji: '????' },
      { jitsi: ':slightly_smiling_face:', emoji: '????' },
      { jitsi: ':scream:', emoji: '????' },
      { jitsi: ':*', emoji: '????' },
      { jitsi: ':-1:', emoji: '????' },
      { jitsi: ':mag:', emoji: '????' },
      { jitsi: ':heart:', emoji: '??????' },
      { jitsi: ':innocent:', emoji: '????' },
      { jitsi: ':angry:', emoji: '????' },
      { jitsi: ':angel:', emoji: '????' },
      { jitsi: ';(', emoji: '????' },
      { jitsi: ':clap:', emoji: '????' },
      { jitsi: ';)', emoji: '????' },
      { jitsi: ':beer:', emoji: '????' },
    ];

    let convertedMessage = message;

    smileyToConvert.forEach(smiley => {
      const reg = new RegExp(escapeStringRegexp(smiley.jitsi), 'g');
      convertedMessage = convertedMessage.replace(reg, smiley.emoji);
    });

    return convertedMessage;
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
