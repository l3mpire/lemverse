import Peer from 'peerjs';

const callsToClose = {};
const callsOpening = {};
let videoElement;

peerBeta = {
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
    _.each(userProximitySensor.nearUsers, user => this.close(user, 100));
  },

  closeCall(userId) {
    let activeCallsCount = 0;
    const close = (remote, user, type) => {
      const callsSource = remote ? remoteCalls : calls;
      const call = callsSource[`${user}-${type}`];
      if (call) {
        activeCallsCount++;
        call.close();
      }

      delete callsSource[`${user}-${type}`];
    };

    close(false, userId, 'user');
    close(false, userId, 'screen');
    close(true, userId, 'user');
    close(true, userId, 'screen');
    this.cancelCallClose(userId);
    this.cancelCallOpening(userId);

    const debug = Meteor.user()?.options?.debug;
    if (activeCallsCount && debug) log('close call: start', userId);

    let streamsByUsers = remoteStreamsByUsers.get();
    streamsByUsers.map(usr => {
      if (usr._id === userId) {
        delete usr.user.srcObject;
        delete usr.screen.srcObject;
      }

      return usr;
    });
    // We clean up remoteStreamsByUsers table by deleting all the users who have neither webcam or screen sharing active
    streamsByUsers = streamsByUsers.filter(usr => usr.user.srcObject !== undefined || usr.screen.srcObject !== undefined);
    remoteStreamsByUsers.set(streamsByUsers);

    $(`.js-video-${userId}-user`).remove();

    if (userProximitySensor.nearUsersCount() === 0) this.destroyStream(myStream);
    if (!activeCallsCount) return;

    if (debug) log('close call: call closed successfully', userId);
    sounds.play('webrtc-out');
  },

  close(userId, timeout = 0) {
    this.cancelCallOpening(userId);
    if (callsToClose[userId] && timeout !== 0) return;
    Meteor.clearTimeout(callsToClose[userId]);
    callsToClose[userId] = Meteor.setTimeout(() => this.closeCall(userId), timeout);
  },

  createPeerCall(user, type) {
    if (!myPeer) return;
    if (calls[`${user._id}-${type}`]) return;
    if (!userProximitySensor.nearUsers[user._id]) { log(`peer call: creation cancelled (user is too far)`, user._id); return; }

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
  },

  createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (!calls[`${user._id}-user`] && !calls[`${user._id}-screen`]) sounds.play('webrtc-in');
    if (shareAudio || shareVideo) this.createStream().then(() => this.createPeerCall(user, 'user'));
    if (shareScreen) this.createScreenStream().then(() => this.createPeerCall(user, 'screen'));
  },

  applyConstraints(stream, type, constraints) {
    if (!stream) return;
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  requestUserMedia() {
    if (myStream) return new Promise(resolve => resolve(myStream));
    const { shareVideo, shareAudio, videoRecorder, audioRecorder } = Meteor.user().profile;

    return navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: shareVideo && videoRecorder || false, width: { ideal: 320 }, height: { ideal: 240 } },
        audio: { deviceId: shareAudio && audioRecorder || false },
        frameRate: { max: 30 },
      })
      .then(stream => {
        myStream = stream;
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': false } });
        return stream;
      })
      .catch(err => {
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

  destroyStream(stream) {
    stream = stream ?? myStream;

    if (stream && Meteor.user()?.options?.debug) log('kill stream', stream);
    this.stopTracks(stream);
    if (videoElement) videoElement.hide();

    if (stream === myStream) myStream = undefined;
    else if (stream === myScreenStream) myScreenStream = undefined;
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

  onProximityStarted(user) {
    if (meet.api) return;
    this.cancelCallClose(user._id);
    Meteor.clearTimeout(callsOpening[user._id]);
    callsOpening[user._id] = Meteor.setTimeout(() => this.createPeerCalls(user), Meteor.settings.public.peer.callDelay);
  },

  onProximityEnded(user) {
    this.close(user._id, 1000);
  },

  cancelCallClose(userId) {
    if (!callsToClose[userId]) return;

    Meteor.clearTimeout(callsToClose[userId]);
    delete callsToClose[userId];
  },

  cancelCallOpening(userId) {
    if (!callsOpening[userId]) return;

    Meteor.clearTimeout(callsOpening[userId]);
    delete callsOpening[userId];
  },

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

  onStreamSettingsChanged(changedUser) {
    const streamsByUsers = remoteStreamsByUsers.get();
    const streamsCurrentUser = streamsByUsers.find(user => user._id === changedUser._id);
    if (!streamsCurrentUser || !streamsCurrentUser.screen.srcObject) return;

    if (!changedUser.profile.shareScreen) {
      delete streamsCurrentUser.screen.srcObject;
      remoteStreamsByUsers.set(streamsByUsers);
    }
  },

  answerStreamCall(remoteCall, remoteStream) {
    const remoteUserId = remoteCall.metadata?.userId;
    if (!remoteUserId) { log(`answer stream: incomplete metadata for the remote call`); return false; }
    const remoteUser = Meteor.users.findOne({ _id: remoteUserId });
    if (!remoteUser) { log(`answer stream: user not found "${remoteUserId}"`); return false; }

    // ensures the user is near to answer and this check will trigger a peer creation if it didn't exist with the other user
    userProximitySensor.checkDistance(Meteor.user(), remoteUser);
    if (!userProximitySensor.nearUsers[remoteUserId]) { log(`answer stream: user is too far`, remoteUserId); return true; }

    const callIdentifier = `${remoteUserId}-${remoteCall.metadata.type}`;
    remoteCalls[callIdentifier] = remoteCall;

    const debug = Meteor.user()?.options?.debug;
    if (debug) log('you -> me ****** answer stream', { userId: remoteUserId, type: remoteCall.metadata.type });

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
    remoteCall.on('close', () => this.close(remoteUserId));

    return true;
  },

  createMyPeer(skipConfig = false) {
    if (myPeer || !Meteor.user()) return;
    if (Meteor.user().profile?.guest) return;

    // init
    if (!videoElement) videoElement = $(`.js-video-me video`);
    userProximitySensor.onProximityStarted = userProximitySensor.onProximityStarted ?? this.onProximityStarted.bind(this);
    userProximitySensor.onProximityEnded = userProximitySensor.onProximityEnded ?? this.onProximityEnded.bind(this);

    Meteor.call('getPeerConfig', (err, result) => {
      if (err) { lp.notif.error(err); return; }

      const debug = Meteor.user()?.options?.debug;
      const { port, url: host, path, config } = result;

      const peerConfig = {
        debug: debug ? 3 : 0,
        host,
        port,
        path,
        config,
      };

      if (skipConfig) delete peerConfig.config;
      myPeer = new Peer(Meteor.userId(), peerConfig);

      if (debug) log('createMyBetaPeer : myPeerCreated', { myPeer });

      myPeer.on('connection', connection => {
        connection.on('data', dataReceived => {
          if (dataReceived.type === 'audio') userVoiceRecorderAbility.playSound(dataReceived.data);
        });
      });

      myPeer.on('close', () => { log('peer closed and destroyed'); myPeer = undefined; });

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
