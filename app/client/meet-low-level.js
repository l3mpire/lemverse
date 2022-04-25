/* eslint-disable prefer-rest-params */

Session.setDefault('meetLowLevelTracks', []);

Template.meetLowLevelTracks.events({
  'click .js-fullscreen'(e) {
    e.target.parentElement.classList.toggle('active');
    $('.meet-low-level-tracks').toggleClass('fullscreen');
  },
});

// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-ljm-api/
meetLowLevel = {
  lowLevel: true,

  api: undefined,
  connection: undefined,
  room: undefined,

  tracks: [],

  isJoined: false,

  onTrackAdded(track) {
    log('onTrackAdded', arguments);

    const id = track.getId();

    meet.tracks.push(track);

    const meetLowLevelTracks = Session.get('meetLowLevelTracks');
    meetLowLevelTracks.push(id);
    Session.set('meetLowLevelTracks', meetLowLevelTracks);

    track.addEventListener(
      window.JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
      t => {
        log('track muted', t.isMuted());

        if (t.isMuted()) $(`#${id}`).hide();
        else $(`#${id}`).show();
      },
    );
    track.addEventListener(
      window.JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED,
      t => log('track stoped', t),
    );

    if (track.getType() === 'audio') {
      $('.meet-low-level-tracks').append(`<div id="${id}" class="hide"><audio class="st" autoplay="1" id="${id}" ${track.isLocal() ? 'muted="true"' : ''}></audio></div>`);
    } else {
      const participant = meet.room.getParticipants().find(p => p.getId() === track.getParticipantId());
      const name = participant?.getDisplayName() || Meteor.user().profile.name || '';

      $('.meet-low-level-tracks').append(`<div id='${id}' class="stream"><div class="stream-name">${name}</div><div class="webcam js-fullscreen"><video class="st" autoplay="1"></video></div></div>`);
    }

    track.attach($(`#${id} .st`)[0]);

    // debug: create tons of track to test the tracks dom layout
    // for (let x = 0; x < 20; x++) {
    //   if (track.getType() === 'audio') {
    //     $('.meet-low-level-tracks').append(`<div id="${id}" class="hide"><audio class="st" autoplay="1" id="${id}"></audio></div>`);
    //   } else {
    //     const participant = meet.room.getParticipants().find(p => p.getId() === track.getParticipantId());
    //     const name = participant?.getDisplayName() || Meteor.user().profile.name || '';
    //     $('.meet-low-level-tracks').append(`<div id="${id}" class="stream"><div class="stream-name">${name}</div><div class="webcam js-fullscreen"><video class="st" autoplay="1"></video></div></div>`);
    //   }
    //   track.attach($(`#${id} .st`)[0]);
    // }
  },

  onTrackRemoved(track) {
    log('onTrackRemoved', arguments);

    const id = track.getId();

    meet.tracks = _.without(meet.tracks, track);

    const meetLowLevelTracks = Session.get('meetLowLevelTracks');
    Session.set('meetLowLevelTracks', _.without(meetLowLevelTracks, id));

    track.detach($(`#${id} .st`)[0]);
    $(`#${id}`).remove();
  },

  onUserLeft(participantId) {
    log('user left', arguments);

    meet.tracks.forEach(t => {
      if (t.getParticipantId() !== participantId) return;
      t.detach($(`#${t.getId()} .st`)[0]);
      $(`#${t.getId()}`).remove();
    });

    meet.tracks = meet.tracks.filter(t => t.getParticipantId() !== participantId);
  },

  onConnectionSuccess() {
    log('onConnectionSuccess', arguments);

    meet.room = meet.connection.initJitsiConference(kebabCase(meet.roomName), {});
    meet.room.on(window.JitsiMeetJS.events.conference.TRACK_ADDED, meet.onTrackAdded);
    meet.room.on(window.JitsiMeetJS.events.conference.TRACK_REMOVED, meet.onTrackRemoved);
    meet.room.on(window.JitsiMeetJS.events.conference.CONFERENCE_JOINED, meet.onConferenceJoined);
    meet.room.on(window.JitsiMeetJS.events.conference.USER_JOINED, () => { log('user join', arguments); });
    meet.room.on(window.JitsiMeetJS.events.conference.USER_LEFT, meet.onUserLeft);
    meet.room.on(window.JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, track => {
      l(`${track.getType()} - ${track.isMuted()}`);
    });
    meet.room.on(window.JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, (userID, displayName) => l(`${userID} - ${displayName}`));
    meet.room.on(window.JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED, () => l(`${meet.room.getPhoneNumber()} - ${meet.room.getPhonePin()}`));

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
    Session.set('meetLowLevelTracks', []);

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

  show(value) {
    this.nodeElement().classList.toggle('show', !!value);
  },

  fullscreen(value) {
    this.nodeElement().classList.toggle('fullscreen', !!value);
  },

  mute() {
    const track = meet.tracks.find(t => t.isLocal() && t.getType() === 'audio');
    if (!track) return;
    track.dispose();
  },

  unmute() {
    window.JitsiMeetJS.createLocalTracks({
      micDeviceId: Meteor?.user()?.profile?.audioRecorder,
      devices: ['audio'],
    }).then(tracks => {
      tracks.forEach(track => {
        if (!meet.isJoined) return;
        meet.room.addTrack(track);
      });
    });
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
    }).then(tracks => {
      tracks.forEach(track => {
        if (!meet.isJoined) return;
        meet.room.addTrack(track);
      });
    });
  },

  shareScreen() {
    window.JitsiMeetJS.createLocalTracks({
      devices: ['desktop'],
    }).then(tracks => {
      tracks.forEach(track => {
        if (!meet.isJoined) return;
        meet.room.addTrack(track);
      });
    });
  },

  unshareScreen() {
    const track = meet.tracks.find(t => t.isLocal() && t.getType() === 'video' && t.getVideoType() === 'desktop');
    if (!track) return;
    track.dispose();
  },

  nodeElement() {
    if (!this.node) this.node = document.querySelector('#meet');
    return this.node;
  },

  userName(name) {
    meet.room.setDisplayName(name);
  },
};
