// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-ljm-api/
if (Meteor.settings.public.lowlevelJitsi) {
  meet = {
    api: undefined,
    connection: undefined,
    room: undefined,

    localTracks: [],
    remoteTracks: {},
    isJoined: false,

    onLocalTracks(tracks) {
      l('onLocalTracks', arguments);
      meet.localTracks = tracks;
      for (let i = 0; i < tracks.length; i++) {
        // meet.localTracks[i].addEventListener(
        //   meet.api.events.track.TRACK_AUDIO_LEVEL_CHANGED,
        //   audioLevel => l(`Audio Level local: ${audioLevel}`),
        // );
        meet.localTracks[i].addEventListener(
          meet.api.events.track.TRACK_MUTE_CHANGED,
          () => l('local track muted'),
        );
        meet.localTracks[i].addEventListener(
          meet.api.events.track.LOCAL_TRACK_STOPPED,
          () => l('local track stoped'),
        );
        meet.localTracks[i].addEventListener(
          meet.api.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
          deviceId => l(`track audio output device was changed to ${deviceId}`),
        );

        if (tracks[i].getType() === 'video') {
          $('.tracks').append(`<video autoplay='1' id='localVideo${i}' />`);
          tracks[i].attach($(`#localVideo${i}`)[0]);
        } else {
          $('.tracks').append(
            `<audio autoplay='1' muted='true' id='localAudio${i}' />`,
          );
          tracks[i].attach($(`#localAudio${i}`)[0]);
        }
        if (meet.isJoined) {
          meet.room.addTrack(tracks[i]);
        }
      }
    },

    onRemoteTrack(track) {
      l('onRemoteTrack', arguments);

      if (track.isLocal()) {
        return;
      }
      const participant = track.getParticipantId();

      if (!meet.remoteTracks[participant]) {
        meet.remoteTracks[participant] = [];
      }
      const idx = meet.remoteTracks[participant].push(track);

      // track.addEventListener(meet.api.events.track.TRACK_AUDIO_LEVEL_CHANGED, audioLevel => l(`Audio Level remote: ${audioLevel}`));
      track.addEventListener(
        meet.api.events.track.TRACK_MUTE_CHANGED,
        () => l('remote track muted'),
      );
      track.addEventListener(
        meet.api.events.track.LOCAL_TRACK_STOPPED,
        () => l('remote track stoped'),
      );
      track.addEventListener(
        meet.api.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
        deviceId => l(`track audio output device was changed to ${deviceId}`),
      );

      const id = participant + track.getType() + idx;

      if (track.getType() === 'video') {
        $('.tracks').append(`<video autoplay='1' id='${participant}video${idx}' />`);
      } else {
        $('.tracks').append(`<audio autoplay='1' id='${participant}audio${idx}' />`);
      }
      track.attach($(`#${id}`)[0]);
    },

    onUserLeft(id) {
      l('user left', arguments);
      if (!meet.remoteTracks[id]) {
        return;
      }
      const tracks = meet.remoteTracks[id];

      for (let i = 0; i < tracks.length; i++) {
        tracks[i].detach($(`#${id}${tracks[i].getType()}`));
      }
    },

    onConnectionSuccess() {
      l('onConnectionSuccess', arguments);

      meet.room = meet.connection.initJitsiConference(kebabCase(meet.roomName), {});
      meet.room.on(meet.api.events.conference.TRACK_ADDED, meet.onRemoteTrack);
      meet.room.on(meet.api.events.conference.TRACK_REMOVED, track => {
        l(`track removed!!!${track}`);
      });
      meet.room.on(meet.api.events.conference.CONFERENCE_JOINED, meet.onConferenceJoined);
      meet.room.on(meet.api.events.conference.USER_JOINED, id => {
        l('user join', arguments);
        meet.remoteTracks[id] = [];
      });
      meet.room.on(meet.api.events.conference.USER_LEFT, meet.onUserLeft);
      meet.room.on(meet.api.events.conference.TRACK_MUTE_CHANGED, track => {
        l(`${track.getType()} - ${track.isMuted()}`);
      });
      meet.room.on(meet.api.events.conference.DISPLAY_NAME_CHANGED, (userID, displayName) => l(`${userID} - ${displayName}`));
      // meet.room.on(
      //   meet.api.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
      //   (userID, audioLevel) => l(`${userID} - ${audioLevel}`),
      // );
      meet.room.on(meet.api.events.conference.PHONE_NUMBER_CHANGED, () => l(`${meet.room.getPhoneNumber()} - ${meet.room.getPhonePin()}`));

      meet.api.createLocalTracks({ devices: ['audio', 'video'] }).then(meet.onLocalTracks);
      meet.room.join();
    },

    onConnectionFailed() { l('onConnectionFailed', arguments); },
    onDisconnected() { l('onDisconnected', arguments); },

    onConferenceJoined() {
      l('onConferenceJoined', arguments);
      meet.isJoined = true;
      for (let i = 0; i < meet.localTracks.length; i++) {
        meet.room.addTrack(meet.localTracks[i]);
      }
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
        bosh: `${Meteor.absoluteUrl()}/http-bind`,
      });

      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_ESTABLISHED, meet.onConnectionSuccess);
      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_FAILED, meet.onConnectionFailed);
      meet.connection.addEventListener(meet.api.events.connection.CONNECTION_DISCONNECTED, meet.onDisconnected);

      // meet.connection.addEventListener(meet.api.events.connection.DEVICE_LIST_CHANGED, meet.onDisconnected);

      meet.roomName = roomName;

      meet.connection.connect();
    },

    close() {
      meet.connection.removeEventListener(meet.api.events.connection.CONNECTION_ESTABLISHED, meet.onConnectionSuccess);
      meet.connection.removeEventListener(meet.api.events.connection.CONNECTION_FAILED, meet.onConnectionFailed);
      meet.connection.removeEventListener(meet.api.events.connection.CONNECTION_DISCONNECTED, meet.disconnect);

      for (let i = 0; i < meet.localTracks.length; i++) {
        meet.localTracks[i].dispose();
      }
      if (meet.room) {
        meet.room.leave();
        meet.room = undefined;
      }
      if (meet.connection) {
        meet.connection.disconnect();
        meet.connection = undefined;
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
