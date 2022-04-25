/* eslint-disable prefer-rest-params */

// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-ljm-api/

Template.meetLowLevelTracks.events({
  'click .js-fullscreen'() {
    Session.set('meetLowLevelFullscreenTrackId', Session.get('meetLowLevelFullscreenTrackId') === this.getId() ? undefined : this.getId());
  },
});

Template.meetLowLevelTracks.helpers({
  track() { return meet.tracks.find(t => t.getId() === `${this}`); },
});

Template.meetLowLevelVideoTrack.helpers({
  name() {
    const participant = meet.room.getParticipants().find(p => p.getId() === this.getParticipantId());
    return participant?.getDisplayName() || Meteor.user().profile.name || '';
  },
});

const trackAttach = () => {
  const track = Template.currentData();
  track.attach($(`#${track.getId()} .st`)[0]);
};

Template.meetLowLevelAudioTrack.onRendered(trackAttach);
Template.meetLowLevelVideoTrack.onRendered(trackAttach);

const trackDetach = () => {
  const track = Template.currentData();
  track.detach($(`#${track.getId()} .st`)[0]);
};

Template.meetLowLevelAudioTrack.onDestroyed(trackDetach);
Template.meetLowLevelVideoTrack.onDestroyed(trackDetach);

meetLowLevel = {
  lowLevel: true,

  api: undefined,
  connection: undefined,
  room: undefined,

  tracks: [],

  isJoined: false,

  onTrackAdded(track) {
    log('onTrackAdded', arguments);

    meet.tracks.push(track);
    Session.set('meetLowLevelTracks', meet.tracks.map(t => t.getId()));
  },

  onTrackRemoved(track) {
    log('onTrackRemoved', arguments);

    meet.tracks = _.without(meet.tracks, track);
    Session.set('meetLowLevelTracks', meet.tracks.map(t => t.getId()));
  },

  onUserLeft(participantId) {
    log('user left', arguments);

    meet.tracks = meet.tracks.filter(t => t.getParticipantId() !== participantId);
    Session.set('meetLowLevelTracks', meet.tracks.map(t => t.getId()));
  },

  onConnectionSuccess() {
    log('onConnectionSuccess', arguments);

    meet.room = meet.connection.initJitsiConference(kebabCase(meet.roomName), {});
    meet.room.on(window.JitsiMeetJS.events.conference.TRACK_ADDED, meet.onTrackAdded);
    meet.room.on(window.JitsiMeetJS.events.conference.TRACK_REMOVED, meet.onTrackRemoved);
    meet.room.on(window.JitsiMeetJS.events.conference.CONFERENCE_JOINED, meet.onConferenceJoined);
    meet.room.on(window.JitsiMeetJS.events.conference.USER_JOINED, () => { log('user join', arguments); });
    meet.room.on(window.JitsiMeetJS.events.conference.USER_LEFT, meet.onUserLeft);

    meet.room.setDisplayName(Meteor.user().profile.name);

    meet.room.join();
  },

  onConnectionFailed() { log('onConnectionFailed', arguments); },
  onDisconnected() { log('onDisconnected', arguments); },

  onConferenceJoined() {
    log('onConferenceJoined', arguments);
    meet.isJoined = true;

    meet.tracks.forEach(track => {
      if (!track.isLocal()) return;
      meet.room.addTrack(track);
    });
  },

  open(roomName = Meteor.settings.public.meet.roomDefaultName) {
    meet.api = window.JitsiMeetJS;

    meet.api.init();

    meet.api.setLogLevel(meet.api.logLevels.ERROR);

    meet.tracks = [];
    Session.set('meetLowLevelTracks', meet.tracks.map(t => t.getId()));

    Session.set('meetLowLevelFullscreenTrackId', undefined);

    meet.connection = new meet.api.JitsiConnection(null, null, {
      hosts: {
        domain: Meteor.settings.public.meet.serverURL,
        muc: 'conference.jitsi.lemverse.com',
      },
      bosh: `${Meteor.absoluteUrl()}http-bind`,
    });

    meet.connection.addEventListener(window.JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, meet.onConnectionSuccess);
    meet.connection.addEventListener(window.JitsiMeetJS.events.connection.CONNECTION_FAILED, meet.onConnectionFailed);
    meet.connection.addEventListener(window.JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, meet.onDisconnected);

    meet.roomName = roomName;

    meet.connection.connect();
  },

  async close() {
    meet.connection.removeEventListener(window.JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, meet.onConnectionSuccess);
    meet.connection.removeEventListener(window.JitsiMeetJS.events.connection.CONNECTION_FAILED, meet.onConnectionFailed);
    meet.connection.removeEventListener(window.JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, meet.onDisconnected);

    await Promise.all(meet.tracks.filter(t => t.isLocal()).map(t => t.dispose()));

    meet.tracks = [];
    Session.set('meetLowLevelTracks', meet.tracks.map(t => t.getId()));

    if (meet.room) {
      await meet.room.leave();
      meet.room = undefined;
    }
    if (meet.connection) {
      meet.connection.disconnect();
      meet.connection = undefined;
    }
    if (meet.api) meet.api = undefined;

    meet.isJoined = false;
  },

  show() {},
  fullscreen() {},

  mute() {
    const track = meet.tracks.find(t => t.isLocal() && t.getType() === 'audio');
    if (!track) return;
    track.dispose();
  },

  onLocalTracksCreated(tracks) {
    tracks.forEach(track => {
      if (!meet.isJoined) return;
      meet.room.addTrack(track);
    });
  },

  unmute() {
    window.JitsiMeetJS.createLocalTracks({
      micDeviceId: Meteor?.user()?.profile?.audioRecorder,
      devices: ['audio'],
    }).then(meet.onLocalTracksCreated);
  },

  hide() {
    const track = meet.tracks.find(t => t.isLocal() && t.getType() === 'video' && t.getVideoType() === 'camera');
    if (!track) return;
    track.dispose();
  },

  unhide() {
    window.JitsiMeetJS.createLocalTracks({
      cameraDeviceId: Meteor?.user()?.profile?.videoRecorder,
      devices: ['video'],
    }).then(meet.onLocalTracksCreated);
  },

  shareScreen() {
    window.JitsiMeetJS.createLocalTracks({
      devices: ['desktop'],
    }).then(meet.onLocalTracksCreated);
  },

  unshareScreen() {
    const track = meet.tracks.find(t => t.isLocal() && t.getType() === 'video' && t.getVideoType() === 'desktop');
    if (!track) return;
    track.dispose();
  },

  userName(name) {
    meet.room.setDisplayName(name);
  },
};
