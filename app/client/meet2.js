// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-ljm-api/
if (Meteor.settings.public.lowlevelJitsi) {
  meet = {
    api: undefined,
    connection: undefined,
    room: undefined,

    localTracks: [],
    remoteTracks: {},
    // let participantIds = new Set();

    onLocalTracks(tracks) {
      l('onLocalTracks', arguments);
      meet.localTracks = tracks;
      for (let i = 0; i < meet.localTracks.length; i++) {
        if (meet.localTracks[i].getType() === 'video') {
          $('body').append(`<video autoplay='1' id='localVideo${i}' />`);
          meet.localTracks[i].attach($(`#localVideo${i}`)[0]);
        } else {
          $('body').append(
            `<audio autoplay='1' muted='true' id='localAudio${i}' />`,
          );
          meet.localTracks[i].attach($(`#localAudio${i}`)[0]);
        }
        // if (isJoined) {
        //   meet.room.addTrack(meet.localTracks[i]);
        // }
      }
    },

    onConnectionSuccess() { l('onConnectionSuccess', arguments); },
    onConnectionFailed() { l('onConnectionFailed', arguments); },
    onDisconnected() { l('onDisconnected', arguments); },
    onRemoteTrack() { l('onRemoteTrack', arguments); },
    onConferenceJoined() { l('onConferenceJoined', arguments); },

    open(roomName = Meteor.settings.public.meet.roomDefaultName) {
      meet.api = window.JitsiMeetJS;

      meet.api.init();

      meet.connection = new meet.api.JitsiConnection(null, null, {
        hosts: {
          domain: Meteor.settings.public.meet.serverURL,
          muc: 'muc.meet.jitsi',
        },
      });

      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_ESTABLISHED, meet.onConnectionSuccess);
      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_FAILED, meet.onConnectionFailed);
      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_DISCONNECTED, meet.onDisconnected);

      meet.connection.connect();

      l({ r: kebabCase(roomName) });

      meet.room = meet.connection.initJitsiConference(kebabCase(roomName), {});
      meet.room.on(meet.api.events.conference.TRACK_ADDED, meet.onRemoteTrack);
      meet.room.on(meet.api.events.conference.CONFERENCE_JOINED, meet.onConferenceJoined);

      meet.api.createLocalTracks({ devices: ['audio', 'video'] }).then(meet.onLocalTracks);

      meet.room.join();
    },

    close() {
      for (let i = 0; i < meet.localTracks.length; i++) {
        meet.localTracks[i].dispose();
      }
      if (meet.room) {
        meet.room.leave();
      }
      if (meet.connection) {
        meet.connection.disconnect();
      }
      if (meet.api) {
        meet.api = undefined;
      }
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
        this.toggleAudio();
      });
    },

    unmute() {
      meet.api.isAudioMuted().then(muted => {
        if (!muted) return;
        this.toggleAudio();
      });
    },

    hide() {
      meet.api.isVideoMuted().then(muted => {
        if (muted) return;
        this.toggleVideo();
      });
    },

    unhide() {
      meet.api.isVideoMuted().then(muted => {
        if (!muted) return;
        this.toggleVideo();
      });
    },

    toggleAudio() {
      meet.api.executeCommand('toggleAudio');
    },

    toggleVideo() {
      meet.api.executeCommand('toggleVideo');
    },

    nodeElement() {
      if (!this.node) this.node = document.querySelector('#meet');
      return this.node;
    },
  };
}
