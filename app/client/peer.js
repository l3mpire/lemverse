import Peer from 'peerjs';

const screenSharingDefaultFrameRate = 22;
const callsToClose = {};
const callsOpening = {};
let videoElement;

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
    this.getVideoElement()?.classList.toggle('active', myStream && enabled);
    if (!myStream) return;
    _.each(myStream.getVideoTracks(), track => { track.enabled = enabled; });
    if (enabled && notifyNearUsers) userProximitySensor.callProximityStartedForAllNearUsers();
    if (myStream.id !== this.getVideoElement().srcObject?.id) this.getVideoElement().srcObject = myStream;
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
      document.querySelectorAll('.js-video-screen-me video').forEach(v => {
        destroyVideoSource(v);
        v.remove();
      });
    } else if (enabled) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  closeAll() {
    if (Meteor.user().options?.debug) log('peer.closeAll: start');
    _.each(userProximitySensor.nearUsers, user => this.close(user._id, 100));
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
        delete usr.waitingCallAnswer;
      }

      return usr;
    });
    // We clean up remoteStreamsByUsers table by deleting all the users who have neither webcam or screen sharing active
    streamsByUsers = streamsByUsers.filter(usr => usr.user.srcObject !== undefined || usr.screen.srcObject !== undefined || usr.waitingCallAnswer);
    remoteStreamsByUsers.set(streamsByUsers);

    if (userProximitySensor.nearUsersCount() === 0) this.destroyStream(myStream);

    $(`.js-video-${userId}-user`).remove();

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
    if (calls[`${user._id}-${type}`]) return;
    if (!userProximitySensor.nearUsers[user._id]) { log(`peer call: creation cancelled (user is too far)`, user._id); return; }

    const debug = Meteor.user()?.options?.debug;
    if (debug) log(`me -> you ${type} ***** new call with near`, user._id);

    this.getPeer().then(peer => {
      const stream = type === 'user' ? myStream : myScreenStream;
      if (!stream) { error(`stream is undefined`, { user, stream, myPeer }); return; }

      if (debug) log(`me -> you ${type} ****** create call with ${user._id} (stream: ${stream.id})`, { user: user._id, stream });
      const call = peer.call(user._id, stream, { metadata: { userId: Meteor.userId(), type } });
      this.createOrUpdateRemoteStream(user, type);
      if (!call) { error(`me -> you ${type} ****** new call is null`, { user, stream, myPeer }); return; }

      if (debug) call.on('close', () => { log(`me -> you ${type} ****** call closed`, user._id); });
      calls[`${user._id}-${type}`] = call;
    });
  },

  createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (!calls[`${user._id}-user`] && !calls[`${user._id}-screen`]) sounds.play('webrtc-in');
    if (shareAudio || shareVideo) this.createStream().then(() => this.createPeerCall(user, 'user'));
    if (shareScreen) this.createScreenStream().then(() => this.createPeerCall(user, 'screen'));
  },

  destroy() {
    this.closeAll();
    if (myStream) this.destroyStream(myStream);
    myPeer?.destroy();
  },

  applyConstraints(stream, type, constraints) {
    if (!stream) return;
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  requestUserMedia(forceNew = false) {
    if (forceNew) this.destroyStream();
    if (myStream) return new Promise(resolve => resolve(myStream));
    const { shareVideo, shareAudio, videoRecorder, audioRecorder } = Meteor.user().profile;

    return navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: shareVideo && videoRecorder || false, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { max: 30 } },
        audio: { deviceId: shareAudio && audioRecorder || false },
      })
      .then(stream => {
        myStream = stream;
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': false } });

        // ensures peers are using last stream & tracks available
        this.updatePeersStream();

        return stream;
      })
      .catch(err => {
        error('requestUserMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': true } });
        if (err.message === 'Permission denied') lp.notif.warning('Camera and microphone are required 😢');
        return Promise.reject(err);
      });
  },

  requestDisplayMedia() {
    if (myScreenStream) return new Promise(resolve => resolve(myScreenStream));
    const { screenShareFrameRate } = Meteor.user().profile;

    return navigator.mediaDevices
      .getDisplayMedia({ frameRate: { ideal: screenShareFrameRate || screenSharingDefaultFrameRate, max: 30 } })
      .then(stream => { myScreenStream = stream; return stream; })
      .catch(err => {
        error('requestDisplayMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
        return Promise.reject(err);
      });
  },

  createStream() {
    return this.requestUserMedia()
      .then(stream => {
        if (!stream) return Promise.reject(new Error(`unable to get a valid stream`));

        // sync video element with the stream
        if (stream.id !== this.getVideoElement().srcObject?.id) this.getVideoElement().srcObject = stream;

        // ensures tracks are up-to-date
        const { shareVideo, shareAudio } = Meteor.user().profile;
        this.audio(shareAudio);
        this.video(shareVideo);

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

    if (stream && Meteor.user()?.options?.debug) log('kill stream', stream.id);
    this.stopTracks(stream);

    const userVideo = this.getVideoElement();
    destroyVideoSource(userVideo);

    if (stream === myStream) myStream = undefined;
    else if (stream === myScreenStream) myScreenStream = undefined;
  },

  updatePeersStream() {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log('update peers stream: start');

    if (myStream) {
      if (debug) log(`update peers stream: main stream ${myStream.id}`, myStream);
      const audioTrack = myStream.getAudioTracks()[0];
      const videoTrack = myStream.getVideoTracks()[0];

      _.each(calls, (call, key) => {
        if (key.indexOf('-screen') !== -1) return;
        if (debug) log(`update peers stream: sending stream to user ${key}`);
        const senders = call.peerConnection.getSenders();

        _.each(senders, sender => {
          if (sender.track.id === audioTrack.id || sender.track.id === videoTrack.id) return;
          if (sender.track.kind === 'audio') sender.replaceTrack(audioTrack);
          else if (sender.track.kind === 'video') sender.replaceTrack(videoTrack);
        });
      });
    }

    if (myScreenStream) {
      if (debug) log(`update peers stream: screen share stream ${myScreenStream.id}`, myScreenStream);
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
    this.getPeer().then(peer => {
      users.forEach(user => {
        try {
          const connection = peer.connect(user._id);

          connection.on('open', () => {
            connection.send(data);

            // Not sure if we must close the connection for now
            setTimeout(() => connection.close(), 500);
          });

          connection.on('error', () => lp.notif.warning(`${user.profile.name || user._id} was unavailable`));
        } catch (err) { lp.notif.error(`an error has occured during connection with ${user.profile.name || user._id}`); }
      });
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

  createOrUpdateRemoteStream(user, streamType, remoteStream = null) {
    const streamsByUsers = remoteStreamsByUsers.get();

    if (!streamsByUsers.find(usr => usr._id === user._id)) {
      streamsByUsers.push({
        _id: user._id,
        name: user.profile.name,
        avatar: user.profile.avatar || Random.choice(Meteor.settings.public.peer.avatars),
        user: {},
        screen: {},
        waitingCallAnswer: true,
      });
    }

    if (remoteStream) {
      streamsByUsers.map(usr => {
        if (usr._id === user._id) {
          delete usr.waitingCallAnswer;
          usr[streamType] = {};
          usr[streamType].srcObject = remoteStream;
        }

        return usr;
      });
    }

    remoteStreamsByUsers.set(streamsByUsers);
  },

  answerCall(remoteCall) {
    const remoteUserId = remoteCall.metadata?.userId;
    if (!remoteUserId) { log(`answer call: incomplete metadata for the remote call`); return false; }
    const remoteUser = Meteor.users.findOne({ _id: remoteUserId });
    if (!remoteUser) { log(`answer call: user not found "${remoteUserId}"`); return false; }

    // ensures the user is near to answer and this check will trigger a peer creation if it didn't exist with the other user
    userProximitySensor.checkDistance(Meteor.user(), remoteUser);
    if (!userProximitySensor.nearUsers[remoteUserId]) { log(`answer call: user is too far`, remoteUserId); return true; }

    const callIdentifier = `${remoteUserId}-${remoteCall.metadata.type}`;
    remoteCalls[callIdentifier] = remoteCall;

    // show the remote call with an empty stream
    this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type, null);

    // update call's with stream received
    const debug = Meteor.user()?.options?.debug;
    remoteCall.on('stream', stream => {
      if (debug) log(`answer stream : from ${remoteUserId} (stream: ${stream.id})`, { userId: remoteUserId, type: remoteCall.metadata.type, stream: stream.id });
      this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type, stream);
    });

    remoteCall.on('close', () => {
      if (debug) log(`call with ${remoteUserId} closed`, { userId: remoteUserId, type: remoteCall.metadata.type });
      this.close(remoteUserId);
    });

    return true;
  },

  getVideoElement() {
    if (!videoElement) videoElement = document.querySelector('.js-video-me video');
    return videoElement;
  },

  getPeer() {
    return new Promise(resolve => {
      if (myPeer && myPeer.id && !myPeer.disconnected) return resolve(myPeer);
      const debug = Meteor.user()?.options?.debug;

      if (myPeer && myPeer.disconnected) {
        let reconnected = true;
        try {
          if (debug) log('Peer disconnected, reconnecting…');
          myPeer.reconnect();
        } catch (err) { reconnected = false; }

        if (reconnected) return resolve(myPeer);
      }

      if (debug) log('Peer invalid, creating new peer…');
      myPeer = undefined;

      return this.createMyPeer().then(resolve);
    });
  },

  createMyPeer(skipConfig = false) {
    if (myPeer && myPeer.id && !myPeer.disconnected) return Promise.resolve(myPeer);
    if (!Meteor.user()) return Promise.reject(new Error(`an user is required to create a peer`));
    if (Meteor.user().profile?.guest) return Promise.reject(new Error(`peer is forbidden for guest account`));

    // init
    userProximitySensor.onProximityStarted = userProximitySensor.onProximityStarted ?? this.onProximityStarted.bind(this);
    userProximitySensor.onProximityEnded = userProximitySensor.onProximityEnded ?? this.onProximityEnded.bind(this);

    return new Promise((resolve, reject) => {
      Meteor.call('getPeerConfig', (err, result) => {
        if (err) { lp.notif.error(err); return reject(new Error(`unable to get peer config`)); }

        const debug = Meteor.user()?.options?.debug;
        const { port, url: host, path, config } = result;

        const peerConfig = {
          debug: debug ? 2 : 0,
          host,
          port,
          path,
          config,
        };

        if (skipConfig) delete peerConfig.config;
        if (myPeer) this.destroy();
        myPeer = new Peer(Meteor.userId(), peerConfig);

        if (debug) log('create peer: myPeer created', { myPeer });

        myPeer.on('connection', connection => {
          connection.on('data', dataReceived => {
            if (dataReceived.type === 'audio') userVoiceRecorderAbility.playSound(dataReceived.data);
          });
        });

        myPeer.on('close', () => { log('peer closed and destroyed'); myPeer = undefined; });

        myPeer.on('error', peerErr => {
          if (['server-error', 'network'].includes(peerErr.type) && myPeer.disconnected) myPeer.reconnect();
          log(`peer error ${peerErr.type}`, peerErr);
          lp.notif.error(`Peer ${peerErr} (${peerErr.type})`);
        });

        myPeer.on('call', remoteCall => {
          if (debug) log(`you -> me ***** new answer call with ${remoteCall.metadata.userId}`, { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });
          remoteCall.answer();

          let attemptCounter = 0;
          const answerAndRetry = () => {
            if (!this.answerCall(remoteCall) && attemptCounter < Meteor.settings.public.peer.answerMaxAttempt) {
              if (debug) log(`you -> me ****** new attempt to answer a call from "${remoteCall.metadata?.userId}"`);
              attemptCounter++;
              setTimeout(answerAndRetry, Meteor.settings.public.peer.answerDelayBetweenAttempt);
            }
          };
          answerAndRetry();
        });

        window.removeEventListener('beforeunload', this.destroy.bind(this));
        window.addEventListener('beforeunload', this.destroy.bind(this));

        return resolve(myPeer);
      });
    });
  },
};
