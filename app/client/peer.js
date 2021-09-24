import Peer from 'peerjs';

myPeer = undefined;
calls = {};
remoteCalls = {};
remoteStreamsByUsers = new ReactiveVar();
remoteStreamsByUsers.set([]);

peer = {
  callsToClose: {},
  callsOpening: {},
  peerLoading: false,

  closeAll() {
    if (Meteor.user().options?.debug) log('peer.closeAll: start');
    _.each(calls, call => this.close(call.peer, 100));
  },

  closeCall(userId) {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log('close call: start', userId);

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

    if (!activeCallsCount) return;
    if (debug) log('close call: call was active');

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

    if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(myStream);

    $(`.js-video-${userId}-user`).remove();

    if (!activeCallsCount) return;

    if (debug) log('close call: call closed successfully', userId);
    sounds.play('webrtc-out');

    // hack: peerjs (https://github.com/peers/peerjs/issues/780) notify manually the other user due to a PeerJS bug not sending the close event
    const otherUser = Meteor.users.findOne(userId);
    if (otherUser) this.sendData([otherUser], { type: 'call-close-done', user: Meteor.userId() });
  },

  close(userId, timeout = 0) {
    this.cancelCallOpening(userId);
    if (this.callsToClose[userId] && timeout !== 0) return;
    clearTimeout(this.callsToClose[userId]);
    this.callsToClose[userId] = setTimeout(() => this.closeCall(userId), timeout);
  },

  createPeerCall(peer, stream, user) {
    const debug = Meteor.user()?.options?.debug;
    const type = stream === myStream ? 'user' : 'screen';

    if (debug) log(`peer call: create new peer call with ${user._id}`, { user: user._id, type });
    if (!stream) { error(`stream is undefined`, { user, stream, myPeer }); return; }

    if (calls[`${user._id}-${type}`]) {
      if (debug) log(`peer call: creation cancelled (call already started)`);
      return;
    }

    if (!userProximitySensor.isUserNear(user)) {
      if (debug) log(`peer call: creation cancelled (user is too far)`);
      this.close(user._id);
      return;
    }

    const call = peer.call(user._id, stream, { metadata: { userId: Meteor.userId(), type } });
    if (!call) {
      error(`peer call: an error occured during call creation`);
      this.close(user._id);
      return;
    }

    // update html element with the last stream instance
    calls[`${user._id}-${type}`] = call;
    this.createOrUpdateRemoteStream(user, type);

    // ensures peers are using last stream & tracks available
    this.updatePeersStream(stream, type);

    if (debug) call.on('close', () => { log(`peer call: call with ${user._id} closed`, user._id); });
    if (debug) log(`peer call: call created!`);
  },

  createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (!calls[`${user._id}-user`] && !calls[`${user._id}-screen`]) sounds.play('webrtc-in');

    this.getPeer().then(peer => {
      if (shareAudio || shareVideo) userStreams.createStream().then(stream => this.createPeerCall(peer, stream, user));
      if (shareScreen) userStreams.createScreenStream().then(stream => this.createPeerCall(peer, stream, user));
    });
  },

  destroy() {
    this.closeAll();
    if (myStream) userStreams.destroyStream(myStream);
    myPeer?.destroy();
    remoteStreamsByUsers.set([]);
  },

  updatePeersStream(stream, type) {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log('update peers stream: start');

    if (type === 'user') {
      if (debug) log(`update peers stream: main stream ${stream.id}`, stream);
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

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

    if (type === 'screen') {
      if (debug) log(`update peers stream: screen share stream ${stream.id}`, stream);
      const screenTrack = stream.getVideoTracks()[0];

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
    this.cancelCallClose(user._id);
    this.cancelCallOpening(user._id);

    if (meet.api) return;
    this.callsOpening[user._id] = setTimeout(() => this.createPeerCalls(user), Meteor.settings.public.peer.callDelay);
  },

  onProximityEnded(user) {
    this.close(user._id, Meteor.settings.public.peer.delayBeforeClosingCall);
  },

  cancelCallClose(userId) {
    if (!this.callsToClose[userId]) return;

    clearTimeout(this.callsToClose[userId]);
    delete this.callsToClose[userId];
  },

  cancelCallOpening(userId) {
    if (!this.callsOpening[userId]) return;

    clearTimeout(this.callsOpening[userId]);
    delete this.callsOpening[userId];
  },

  sendData(users, data) {
    users = users.filter(Boolean); // remove falsy values
    if (!users.length) return Promise.reject(new Error(`no users targeted`));

    return this.getPeer().then(peer => {
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

      return users.length;
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

    // IMPORTANT :
    // It looks like Meteor update locale collection when user focus the tab (chrome put asleep the tab maybe)
    // So, the locale position is probably the old-one, blocking the logic below
    // ensures users is still near on answer
    // userProximitySensor.checkDistance(Meteor.user(), remoteUser);
    // if (!userProximitySensor.isUserNear(remoteUser)) {
    //   log(`answer call: user is too far`, remoteUserId);
    //   this.close(remoteUserId);
    //   return false;
    // }

    // answer the call
    remoteCall.answer();

    const callIdentifier = `${remoteUserId}-${remoteCall.metadata.type}`;
    remoteCalls[callIdentifier] = remoteCall;

    // show the remote call with an empty stream
    this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type);

    // update call's with stream received
    const debug = Meteor.user()?.options?.debug;
    remoteCall.on('stream', stream => {
      if (debug) log(`remote call "${remoteUserId}" sent stream (${stream.id})`, { userId: remoteUserId, type: remoteCall.metadata.type, stream: stream.id });
      this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type, stream);
    });

    remoteCall.on('close', () => {
      if (debug) log(`remote call closed (with ${remoteUserId})`, { userId: remoteUserId, type: remoteCall.metadata.type });
      this.close(remoteUserId);
    });

    // ensures a call to the other user exists on an answer to avoid one-way calls, do nothing if a call is already started
    this.createPeerCalls(remoteUser);

    return true;
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

        // peerjs reconnect doesn't offer a promise or callback so we have to wait a certain time until the reconnection is done
        if (reconnected) return waitFor(() => myPeer && myPeer.id && !myPeer.disconnected, 5, 250).then(() => resolve(myPeer));
      }

      if (!myPeer && this.peerLoading) return waitFor(() => myPeer !== undefined, 5, 250).then(() => resolve(myPeer));

      if (debug) log('Peer invalid, creating new peer…');
      myPeer = undefined;
      this.peerLoading = false;

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

    this.peerLoading = true;
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
            if (dataReceived.type === 'call-close-done') {
              if (debug) log(`remote peer closed call (${dataReceived.user})`, { myPeer });
              this.close(dataReceived.user);
            }
          });
        });

        myPeer.on('close', () => { log('peer closed and destroyed'); myPeer = undefined; });

        myPeer.on('error', peerErr => {
          if (['server-error', 'network'].includes(peerErr.type) && myPeer.disconnected) myPeer.reconnect();
          log(`peer error ${peerErr.type}`, peerErr);
          lp.notif.error(`Peer ${peerErr} (${peerErr.type})`);
        });

        myPeer.on('call', remoteCall => {
          if (debug) log(`new call: from ${remoteCall.metadata.userId}`, { userId: remoteCall.metadata.userId });
          if (meet.api) {
            log(`new call: ignored (meet is open)`, { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });
            return;
          }

          this.answerCall(remoteCall);
        });

        window.removeEventListener('beforeunload', this.destroy.bind(this));
        window.addEventListener('beforeunload', this.destroy.bind(this));
        this.peerLoading = false;

        return resolve(myPeer);
      });
    });
  },
};
