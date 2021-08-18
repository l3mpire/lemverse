import Peer from 'peerjs';

const Phaser = require('phaser');

let videoElement;

// webrtc
myStream = undefined;
myScreenStream = undefined;
myPeer = undefined;
calls = {};
remoteCalls = {};

remoteStreamsByUsers = new ReactiveVar();

remoteStreamsByUsers.set([]);

peer = {
  audio(enabled, notifyNearUsers = false) {
    if (!myStream) return;
    _.each(myStream.getAudioTracks(), track => { track.enabled = enabled; });
    if (enabled && notifyNearUsers) userProximitySensor.callProximityStartedForAllNearUsers();
  },
  video(enabled, notifyNearUsers = false) {
    videoElement?.toggle(myStream && enabled);
    if (!myStream) return;
    _.each(myStream.getVideoTracks(), track => { track.enabled = enabled; });
    if (enabled && notifyNearUsers) userProximitySensor.callProximityStartedForAllNearUsers();
    if (myStream.id !== videoElement[0].srcObject?.id) videoElement[0].srcObject = myStream;
  },
  stopTracks(stream) {
    if (!stream) return;
    _.each(stream.getTracks(), track => track.stop());
  },
  screen(enabled) {
    if (myScreenStream && !enabled) {
      this.stopTracks(myScreenStream);
      myScreenStream = undefined;
      _.each(calls, (call, key) => {
        if (key.indexOf('-screen') === -1) return;
        if (Meteor.user().options?.debug) log('me -> you screen ****** I stop sharing screen, call closing', key);
        call.close();
        delete calls[key];
      });

      const divElm = document.querySelector('.js-video-screen-me');
      divElm.srcObject = undefined;
      divElm.style.display = 'none';
      document.querySelectorAll('.js-video-screen-me video').forEach(v => v.remove());
    } else if (enabled) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  closeAll() {
    if (Meteor.user().options?.debug) log('peer.closeAll: start');
    _.each(_.union(_.keys(calls), _.keys(remoteCalls)), k => peer.close(k.split('-')[0]));
  },

  close(userId) {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log('peer.close: start', userId);
    if (calls[`${userId}-user`]) {
      if (debug) log('me -> you user ****** force close call', userId);
      calls[`${userId}-user`].close();
      delete calls[`${userId}-user`];
      sounds.play('webrtc-out');
    }

    // Get the updated streamsByUsers of the reactiveVar remoteStreamsByUsers
    let streamsByUsers = remoteStreamsByUsers.get();

    // Iterate on remoteStreamsByUsers table to find the remote user and delete the concerned media
    streamsByUsers.map(usr => {
      if (usr._id === userId) {
        delete usr.user.srcObject;
        delete usr.screen.srcObject;
      }
      return usr;
    });
    // We clean up remoteStreamsByUsers table by deleting all the users who have neither webcam or screen sharing active
    streamsByUsers = streamsByUsers.filter(usr => usr.user.srcObject !== undefined || usr.screen.srcObject !== undefined);
    // Update the reactiveVar remoteStreamsByUsers
    remoteStreamsByUsers.set(streamsByUsers);

    if (remoteCalls[`${userId}-user`]) {
      if (debug) log('you -> me user ****** force close remoteCall', userId);
      remoteCalls[`${userId}-user`].close();
      delete remoteCalls[`${userId}-user`];
      $(`.js-video-${userId}-user`).remove();
    }
  },

  createPeerCall(user, type) {
    if (!myPeer) return;
    if (calls[`${user._id}-${type}`]) return;

    if (Meteor.user().options?.debug) log(`me -> you ${type} ***** new call with near`, user._id);
    if (myPeer.disconnected) {
      try {
        lp.notif.error(`Peer disconnected, reconnecting…`);
        myPeer.reconnect();
      } catch (err) {
        if (myPeer.destroyed) this.createMyPeer();
      }

      setTimeout(() => this.createPeerCall(user, type), 1000);

      return;
    }

    const stream = type === 'user' ? myStream : myScreenStream;
    if (!stream) { error(`stream is undefined`, { user, stream, myPeer }); return; }

    const call = myPeer.call(user._id, stream, { metadata: { userId: Meteor.userId(), type } });
    if (!call) { error(`me -> you ${type} ***** new call is null`, { user, stream, myPeer }); return; }

    if (Meteor.user().options?.debug) {
      call.on('stream', () => { log(`me -> you ${type} DEPRECATED ****** call stream`, user._id); });
      call.on('close', () => { log(`me -> you ${type} ****** call closed`, user._id); });
    }
    calls[`${user._id}-${type}`] = call;

    if (type === 'user') sounds.play('webrtc-in');
  },

  createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (shareAudio || shareVideo) this.createStream().then(() => this.createPeerCall(user, 'user'));
    if (shareScreen) this.createScreenStream().then(() => this.createPeerCall(user, 'screen'));
  },

  requestUserMedia() {
    if (myStream) return new Promise(resolve => resolve(myStream));
    const { shareVideo, shareAudio, videoRecorder, audioRecorder } = Meteor.user().profile;

    return navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: shareVideo && videoRecorder || false },
        audio: { deviceId: shareAudio && audioRecorder || false },
      })
      .then(stream => {
        myStream = stream;
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': false } });
        return stream;
      })
      .catch(err => {
        myStream = null;
        error('requestUserMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': true } });
      });
  },

  requestDisplayMedia() {
    if (myScreenStream) return new Promise(resolve => resolve(myScreenStream));

    return navigator.mediaDevices
      .getDisplayMedia({})
      .then(stream => { myScreenStream = stream; return stream; })
      .catch(err => {
        myScreenStream = null;
        error('requestDisplayMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
      });
  },

  createStream() {
    return this.requestUserMedia()
      .then(stream => {
        if (!stream) return undefined;

        // sync video element with the stream
        if (stream.id !== videoElement[0].srcObject?.id) videoElement[0].srcObject = stream;

        // ensures tracks are up-to-date
        const { shareVideo, shareAudio } = Meteor.user().profile;
        this.audio(shareAudio);
        this.video(shareVideo);

        // ensures peers are using last stream & tracks available
        this.updatePeersStream();

        return stream;
      });
  },

  createScreenStream() {
    return this.requestDisplayMedia()
      .then(stream => {
        if (!stream) return undefined;

        stream.getVideoTracks().forEach(track => { track.contentHint = 'text'; });

        let videoElm = document.querySelector('.js-video-screen-me video');
        if (!videoElm) {
          videoElm = document.createElement('video');
          videoElm.setAttribute('type', 'video/mp4');

          const videoElmParent = document.querySelector('.js-video-screen-me');
          videoElmParent.style.display = 'block';
          videoElmParent.appendChild(videoElm);
        }

        videoElm.autoplay = true;
        videoElm.srcObject = stream;

        // ensures peers are using last stream & tracks available
        this.updatePeersStream();

        return stream;
      });
  },

  destroyStream() {
    this.stopTracks(myStream);
    myStream = null;
    if (videoElement) videoElement.hide();
  },

  updatePeersStream() {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      const videoTrack = myStream.getVideoTracks()[0];

      _.each(calls, (call, key) => {
        if (key.indexOf('-screen') !== -1) return;
        const senders = call.peerConnection.getSenders();

        _.each(senders, sender => {
          if (sender.track.id === audioTrack.id || sender.track.id === videoTrack.id) return;
          if (sender.track.kind === 'audio') sender.replaceTrack(audioTrack);
          else if (sender.track.kind === 'video') sender.replaceTrack(videoTrack);
        });
      });
    }

    if (myScreenStream) {
      const screenTrack = myScreenStream.getVideoTracks()[0];

      _.each(calls, (call, key) => {
        if (key.indexOf('-screen') === -1) return;
        const senders = call.peerConnection.getSenders();

        _.each(senders, sender => {
          if (sender.track.id === screenTrack.id || sender.track.kind !== 'video') return;
          sender.replaceTrack(screenTrack);
        });
      });
    }
  },

  onProximityEnded() { },

  sendData(users, data) {
    users.forEach(user => {
      try {
        const connection = myPeer.connect(user._id);

        connection.on('open', () => {
          connection.send(data);

          // Not sure if we must close the connection for now
          setTimeout(() => connection.close(), 500);
        });

        connection.on('error', () => lp.notif.warning(`${user.profile.name || user._id} was unavailable`));
      } catch (err) { lp.notif.error(`an error has occured during connection with ${user.profile.name || user._id}`); }
    });
  },

  checkDistances(changedUser) {
    const { player } = game?.scene?.keys?.WorldScene || {};
    if (!myPeer || !player || meet.api) return;
    const debug = Meteor.user()?.options?.debug;

    // init
    if (!videoElement) videoElement = $(`.js-video-me video`);
    userProximitySensor.onProximityStarted = userProximitySensor.onProximityStarted ?? this.createPeerCalls.bind(this);
    userProximitySensor.onProximityEnded = userProximitySensor.onProximityEnded ?? this.onProximityEnded.bind(this);

    // listeners
    const currentUser = Meteor.user();
    const changedUsers = changedUser ? [changedUser] : Meteor.users.find({ _id: { $ne: Meteor.userId() } }).fetch();
    userProximitySensor.checkDistances(currentUser, changedUsers);

    //
    // Close peer calls for too far people
    //

    const prepareClosing = (dist, myCall, userId, type) => {
      const direction = myCall ? 'me -> you' : 'you -> me';
      const call = myCall ? calls[`${userId}-${type}`] : remoteCalls[`${userId}-${type}`];
      if (dist >= userProximitySensor.farDistance && call && !call.closeHandler) {
        if (debug) log(`${direction} ${type} ****** too far call soon`, userId);
        call.closeHandler = Meteor.setTimeout(() => {
          if (debug) log(`${direction} ${type} ****** too far call closing`, userId);
          call.close();
          if (myCall) {
            delete calls[`${userId}-${type}`];
            if (type === 'user') {
              sounds.play('webrtc-out');
              if (_.keys(calls).filter(c => c.indexOf('-user') >= 0).length === 0) {
                if (debug) log('kill my stream');
                this.destroyStream();
              }
            }
          } else {
            delete remoteCalls[`${userId}-${type}`];
            // Get the updated streams of the reactiveVar remoteStreamsByUsers
            let streamsByUsers = remoteStreamsByUsers.get();

            // Iterate on remoteStreamsByUsers table to find the remote user and delete the concerned media
            streamsByUsers.map(usr => {
              if (usr._id === userId) {
                delete usr[type].srcObject;
              }
              return usr;
            });
            // We clean up remoteStreamsByUsers table by deleting all the users who have neither webcam or screen sharing active
            streamsByUsers = streamsByUsers.filter(usr => usr.user.srcObject !== undefined || usr.screen.srcObject !== undefined);

            // Update the reactiveVar remoteStreamsByUsers
            remoteStreamsByUsers.set(streamsByUsers);
          }
        }, 1000);
      }
      if (dist < userProximitySensor.nearDistance && call?.closeHandler) {
        if (debug) log(`${direction} ${type} ****** too far call abort`, userId);

        Meteor.clearTimeout(call.closeHandler);
        delete call.closeHandler;
      }
    };

    const cleanMedia = () => {
      if (changedUsers.length) {
        const streamsByUsers = remoteStreamsByUsers.get();
        let setUpdated = false;
        changedUsers.forEach(changedUsr => {
          const streamsCurrentUser = streamsByUsers.find(user => user._id === changedUsr._id);
          if (streamsCurrentUser) {
            if (!changedUsr.profile.shareScreen && streamsCurrentUser.screen.srcObject) {
              delete streamsCurrentUser.screen.srcObject;
              setUpdated = true;
            }
          }
        });
        if (setUpdated) remoteStreamsByUsers.set(streamsByUsers);
      }
    };
    cleanMedia();

    _.each(changedUsers, user => {
      // eslint-disable-next-line new-cap
      const dist = Phaser.Math.Distance.Between(user.profile.x, user.profile.y, player.x, player.y);
      prepareClosing(dist, true, user._id, 'user');
      prepareClosing(dist, false, user._id, 'user');
      prepareClosing(dist, true, user._id, 'screen');
      prepareClosing(dist, false, user._id, 'screen');
    });
  },

  answerStreamCall(remoteCall, remoteStream) {
    const debug = Meteor.user()?.options?.debug;

    if (debug) log('you -> me ****** answer stream', { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });

    const remoteUser = Meteor.users.findOne({ _id: remoteCall.metadata.userId });
    if (!remoteUser) { log(`incomplete metadata for the remote user "${remoteCall.metadata?.userId}"`); return false; }

    // Get the updated stream table of the reactiveVar remoteStreamsByUsers
    const streamsByUsers = remoteStreamsByUsers.get();

    // If the remote user isn't in stream array, we create an object for him to prepare the addition of his stream.
    if (!streamsByUsers.find(usr => usr._id === remoteUser._id)) {
      streamsByUsers.push({
        _id: remoteUser._id,
        name: remoteUser.profile.name,
        avatar: remoteUser.profile.avatar || Random.choice(Meteor.settings.public.peer.avatars),
        user: {},
        screen: {},
      });
    }

    // We iterate on all streams table to find the remote user concerned by the addition of the new media and update it
    streamsByUsers.map(usr => {
      if (usr._id === remoteUser._id) {
        usr[remoteCall.metadata.type] = {};
        usr[remoteCall.metadata.type].srcObject = remoteStream;
      }
      return usr;
    });

    // Update the reactiveVar remoteStreamsByUsers
    remoteStreamsByUsers.set(streamsByUsers);

    if (debug) {
      remoteCall.on('close', () => {
        log('you -> me ****** answer closed', { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });
      });
    }

    remoteCalls[`${remoteCall.metadata.userId}-${remoteCall.metadata.type}`] = remoteCall;

    return true;
  },

  createMyPeer() {
    if (myPeer || !Meteor.user()) return;
    if (Meteor.user().profile?.guest) return;

    Meteor.call('getPeerConfig', (err, result) => {
      if (err) { lp.notif.error(err); return; }

      const debug = Meteor.user()?.options?.debug;
      const { port, url: host, path, config } = result;

      myPeer = new Peer(Meteor.userId(), {
        debug: debug ? 3 : 0,
        host,
        port,
        path,
        config,
      });

      if (debug) log('createMyPeer : myPeerCreated', { myPeer });

      myPeer.on('connection', connection => {
        connection.on('data', dataReceived => {
          if (dataReceived.type === 'audio') userVoiceRecorderAbility.playSound(dataReceived.data);
        });
      });

      myPeer.on('close', () => { log('peer closed and destroyed'); myPeer = null; });

      myPeer.on('error', peerErr => {
        log(`peer error ${peerErr.type}`, peerErr);
        lp.notif.error(peerErr);
      });

      myPeer.on('call', remoteCall => {
        if (debug) log('you -> me ***** new answer with near', { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });
        remoteCall.answer();
        remoteCall.on('stream', remoteStream => {
          let attemptCounter = 0;

          const answerAndRetry = () => {
            if (!this.answerStreamCall(remoteCall, remoteStream) && attemptCounter < Meteor.settings.public.peer.answerMaxAttempt) {
              if (debug) log(`you -> me ****** new attempt to answer a call from "${remoteCall.metadata?.userId}"`);
              attemptCounter++;
              setTimeout(answerAndRetry, Meteor.settings.public.peer.answerDelayBetweenAttempt);
            }
          };
          answerAndRetry();
        });
      });
    });
  },
};
