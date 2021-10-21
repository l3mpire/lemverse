import Peer from 'peerjs';

peer = {
  calls: {},
  callsToClose: {},
  callsOpening: {},
  remoteCalls: {},
  peerInstance: undefined,
  peerLoading: false,
  remoteStreamsByUsers: new ReactiveVar([]),
  sensorEnabled: true,

  init() {
    userProximitySensor.onProximityStarted = this.onProximityStarted.bind(this);
    userProximitySensor.onProximityEnded = this.onProximityEnded.bind(this);
  },

  closeAll() {
    if (Meteor.user().options?.debug) log('peer.closeAll: start');
    _.each(this.calls, call => this.close(call.peer, Meteor.settings.public.peer.delayBeforeClosingCall, 'close-all'));
  },

  closeCall(userId, origin) {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log(`close call: start (${origin})`, userId);

    let activeCallsCount = 0;
    const close = (remote, user, type) => {
      const callsSource = remote ? this.remoteCalls : this.calls;
      const call = callsSource[`${user}-${type}`];
      if (call) {
        activeCallsCount++;
        call.close();
      }

      delete callsSource[`${user}-${type}`];
    };

    close(false, userId, streamTypes.main);
    close(false, userId, streamTypes.screen);
    close(true, userId, streamTypes.main);
    close(true, userId, streamTypes.screen);
    this.cancelCallClose(userId);
    this.cancelCallOpening(userId);

    if (activeCallsCount && debug) log('close call: call was active');

    let streamsByUsers = this.remoteStreamsByUsers.get();
    streamsByUsers.map(usr => {
      if (usr._id === userId) {
        delete usr.main.srcObject;
        delete usr.screen.srcObject;
        delete usr.waitingCallAnswer;
      }

      return usr;
    });
    // We clean up remoteStreamsByUsers table by deleting all the users who have neither webcam or screen sharing active
    streamsByUsers = streamsByUsers.filter(usr => usr.main.srcObject !== undefined || usr.screen.srcObject !== undefined || usr.waitingCallAnswer);
    this.remoteStreamsByUsers.set(streamsByUsers);

    if (userProximitySensor.nearUsersCount() === 0) userStreams.destroyStream(streamTypes.main);

    $(`.js-video-${userId}-user`).remove();

    if (!activeCallsCount) return;

    if (debug) log('close call: call closed successfully', userId);
    sounds.play('webrtc-out');
  },

  close(userId, timeout = 0, origin = null) {
    this.cancelCallOpening(userId);
    if (this.callsToClose[userId] && timeout !== 0) return;
    clearTimeout(this.callsToClose[userId]);
    this.callsToClose[userId] = setTimeout(() => this.closeCall(userId, origin), timeout);
  },

  createPeerCall(peer, stream, user) {
    const debug = Meteor.user()?.options?.debug;
    const type = stream === userStreams.streams.main.instance ? 'main' : 'screen';

    if (debug) log(`peer call: create new peer call with ${user._id}`, { user: user._id, type });
    if (!stream) { error(`stream is undefined`, { user, stream }); return; }

    if (this.calls[`${user._id}-${type}`]) {
      if (debug) log(`peer call: creation cancelled (call already started)`);
      return;
    }

    if (!userProximitySensor.isUserNear(user)) {
      if (debug) log(`peer call: creation cancelled (user is too far)`);
      this.close(user._id, 0, 'far-user');
      return;
    }

    const call = peer.call(user._id, stream, { metadata: { userId: Meteor.userId(), type } });
    if (!call) {
      error(`peer call: an error occured during call creation`);
      this.close(user._id, 0, 'peer-error');
      return;
    }

    // update html element with the last stream instance
    this.calls[`${user._id}-${type}`] = call;
    this.createOrUpdateRemoteStream(user, type);

    // ensures peers are using last stream & tracks available
    this.updatePeersStream(stream, type);

    if (debug) call.on('close', () => { log(`peer call: call with ${user._id} closed`, user._id); });
    if (debug) log(`peer call: call created!`);
  },

  createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (!this.calls[`${user._id}-${streamTypes.main}`] && !this.calls[`${user._id}-${streamTypes.screen}`]) {
      sounds.play('webrtc-in');
      if (userProximitySensor.nearUsersCount() === 1) Meteor.call('addUserInterruption');
    }

    this.getPeer().then(peer => {
      if (shareAudio || shareVideo) userStreams.createStream().then(stream => this.createPeerCall(peer, stream, user));
      if (shareScreen) userStreams.createScreenStream().then(stream => this.createPeerCall(peer, stream, user));
    });
  },

  destroy() {
    this.closeAll();
    userStreams.destroyStream(streamTypes.main);
    this.peerInstance?.destroy();
    this.remoteStreamsByUsers.set([]);
  },

  updatePeersStream(stream, type) {
    const debug = Meteor.user()?.options?.debug;
    if (debug) log('update peers stream: start');

    if (type === streamTypes.main) {
      if (debug) log(`update peers stream: main stream ${stream.id}`, stream);
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      _.each(this.calls, (call, key) => {
        if (key.indexOf('-screen') !== -1) return;
        if (debug) log(`update peers stream: sending stream to user ${key}`);
        const senders = call.peerConnection.getSenders();

        _.each(senders, sender => {
          if (sender.track.id === audioTrack.id || sender.track.id === videoTrack.id) return;
          if (sender.track.kind === 'audio') sender.replaceTrack(audioTrack);
          else if (sender.track.kind === 'video') sender.replaceTrack(videoTrack);
        });
      });
    } else if (type === streamTypes.screen) {
      if (debug) log(`update peers stream: screen share stream ${stream.id}`, stream);
      const screenTrack = stream.getVideoTracks()[0];

      _.each(this.calls, (call, key) => {
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
    if (!this.sensorEnabled) return;

    this.cancelCallClose(user._id);
    this.cancelCallOpening(user._id);

    if (meet.api || Meteor.user()?.profile.guest) return;
    this.callsOpening[user._id] = setTimeout(() => this.createPeerCalls(user), Meteor.settings.public.peer.callDelay);
  },

  onProximityEnded(user) {
    this.close(user._id, Meteor.settings.public.peer.delayBeforeClosingCall, 'proximity-ended');
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
    const streamsByUsers = this.remoteStreamsByUsers.get();
    const streamsCurrentUser = streamsByUsers.find(user => user._id === changedUser._id);
    if (!streamsCurrentUser || !streamsCurrentUser.screen.srcObject) return;

    if (!changedUser.profile.shareScreen) {
      delete streamsCurrentUser.screen.srcObject;
      this.remoteStreamsByUsers.set(streamsByUsers);
    }
  },

  createOrUpdateRemoteStream(user, streamType, remoteStream = null) {
    const streamsByUsers = this.remoteStreamsByUsers.get();

    if (!streamsByUsers.find(usr => usr._id === user._id)) {
      streamsByUsers.push({
        _id: user._id,
        name: user.profile.name,
        avatar: getRandomAvatarForUser(user),
        main: {},
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

    this.remoteStreamsByUsers.set(streamsByUsers);
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
    this.remoteCalls[callIdentifier] = remoteCall;

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
      this.close(remoteUserId, 0, 'peerjs-event');
    });

    // ensures a call to the other user exists on an answer to avoid one-way calls, do nothing if a call is already started
    this.createPeerCalls(remoteUser);

    return true;
  },

  getPeer() {
    return new Promise(resolve => {
      if (this.isPeerValid(this.peerInstance)) return resolve(this.peerInstance);
      const debug = Meteor.user()?.options?.debug;

      if (this.peerInstance?.disconnected) {
        let reconnected = true;
        try {
          if (debug) log('Peer disconnected, reconnecting…');
          this.peerInstance.reconnect();
        } catch (err) { reconnected = false; }

        // peerjs reconnect doesn't offer a promise or callback so we have to wait a certain time until the reconnection is done
        if (reconnected) return waitFor(() => this.isPeerValid(this.peerInstance), 5, 250).then(() => resolve(this.peerInstance));
      }

      if (!this.peerInstance && this.peerLoading) return waitFor(() => this.peerInstance !== undefined, 5, 250).then(() => resolve(this.peerInstance));

      if (debug) log('Peer invalid, creating new peer…');
      this.peerInstance = undefined;
      this.peerLoading = false;

      return this.createMyPeer().then(resolve);
    });
  },

  createMyPeer(skipConfig = false) {
    if (this.isPeerValid(this.peerInstance)) return Promise.resolve(this.peerInstance);
    if (!Meteor.user()) return Promise.reject(new Error(`an user is required to create a peer`));
    if (Meteor.user().profile?.guest) return Promise.reject(new Error(`peer is forbidden for guest account`));

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
        if (this.peerInstance) this.destroy();
        this.peerInstance = new Peer(Meteor.userId(), peerConfig);

        if (debug) log(`create peer: created (${this.peerInstance.id})`);

        this.peerInstance.on('connection', connection => {
          connection.on('data', dataReceived => {
            if (dataReceived.type === 'audio') userVoiceRecorderAbility.playSound(dataReceived.data);
          });
        });

        this.peerInstance.on('close', () => { log('peer closed and destroyed'); this.peerInstance = undefined; });

        this.peerInstance.on('error', peerErr => {
          if (['server-error', 'network'].includes(peerErr.type) && this.peerInstance.disconnected) this.peerInstance.reconnect();
          log(`peer error ${peerErr.type}`, peerErr);
          lp.notif.error(`Peer ${peerErr} (${peerErr.type})`);
        });

        this.peerInstance.on('call', remoteCall => {
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

        return resolve(this.peerInstance);
      });
    });
  },

  isPeerValid(peer) {
    return peer?.id && !peer.disconnected;
  },

  isEnabled() {
    return this.sensorEnabled;
  },
};
