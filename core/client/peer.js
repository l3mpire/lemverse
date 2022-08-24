import Peer from 'peerjs';
import audioManager from './audio-manager';
import { canAnswerCall } from './helpers';

const debug = (text, meta) => {
  if (!Meteor.user().options?.debug) return;
  log(text, meta);
};

peer = {
  calls: {},
  callsToClose: {},
  callsOpening: {},
  discussionStartDate: undefined,
  remoteCalls: {},
  peerInstance: undefined,
  peerLoading: false,
  remoteStreamsByUsers: new ReactiveVar([]),
  sensorEnabled: true,
  enabled: true,
  lockedCalls: {},
  reconnect: {
    autoReconnectOnClose: true,
    delayBetweenAttempt: 250,
  },
  securityCheckInterval: 2000,

  init() {
    window.addEventListener(eventTypes.onUsersComeCloser, e => {
      const { users } = e.detail;
      peer.onProximityStarted(users);
    });

    window.addEventListener(eventTypes.onUsersMovedAway, e => {
      const { users } = e.detail;
      peer.onProximityEnded(users);
    });
    this.enable();

    // For security reasons we periodically check that the users in discussion are still close to the calling users
    window.setInterval(() => {
      const callEntries = Object.entries(this.remoteCalls);
      if (!callEntries.length) return;

      callEntries.forEach(entry => {
        if (userProximitySensor.isUserNear({ _id: entry[1].metadata.userId })) return;
        this.closeCall(entry[1].metadata.userId, 0, 'security-user-far');
      });
    }, this.securityCheckInterval);
  },

  enable() {
    this.enabled = true;
  },

  disable() {
    this.enabled = false;
    this.closeAll();
  },

  closeAll() {
    debug('peer.closeAll: start');
    _.each(this.calls, call => this.close(call.peer, Meteor.settings.public.peer.delayBeforeClosingCall, 'close-all'));
  },

  closeCall(userId, origin) {
    debug(`closeCall: start (${origin})`, { userId });

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

    this.unlockCall(userId, true);
    close(false, userId, streamTypes.main);
    close(false, userId, streamTypes.screen);
    close(true, userId, streamTypes.main);
    close(true, userId, streamTypes.screen);
    this.cancelCallClose(userId);
    this.cancelCallOpening(userId);

    const debutText = activeCallsCount ? 'closeCall: call was active' : 'closeCall: call was inactive';
    debug(debutText, { sourceAmount: activeCallsCount });

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

    if (!this.hasActiveStreams()) {
      userStreams.destroyStream(streamTypes.main);

      if (this.discussionStartDate) {
        const duration = (Date.now() - this.discussionStartDate) / 1000;
        Meteor.call('analyticsDiscussionEnd', { duration });
        this.discussionStartDate = undefined;
      }
    }

    $(`.js-video-${userId}-user`).remove();
    debug('closeCall: call closed successfully', { userId });

    if (!activeCallsCount) return;

    audioManager.play('webrtc-out.mp3', 0.2);
  },

  close(userId, timeout = 0, origin = null) {
    debug(`close: start (${origin})`, { userId });
    this.cancelCallOpening(userId);
    if (this.callsToClose[userId] && timeout !== 0) return;
    this.callsToClose[userId] = setTimeout(() => this.closeCall(userId, origin), timeout);
  },

  createPeerCall(peer, user, stream, streamType) {
    debug(`createPeerCall: calling remote user`, { user: user._id, streamType });
    if (!stream) { error(`createPeerCall: stream is undefined`, { user, stream }); return; }

    if (this.calls[`${user._id}-${streamType}`]) {
      debug(`createPeerCall: creation cancelled (call already started)`);
      return;
    }

    if (!canAnswerCall(user)) {
      debug(`createPeerCall: creation cancelled (user is too far)`);
      this.close(user._id, 0, 'far-user');
      return;
    }

    const call = peer.call(user._id, stream, { metadata: { userId: Meteor.userId(), type: streamType } });
    if (!call) {
      error(`createPeerCall: an error occured during call creation (peerjs error)`);
      this.close(user._id, 0, 'peer-error');
      return;
    }

    // update html element with the last stream instance
    this.calls[`${user._id}-${streamType}`] = call;
    this.createOrUpdateRemoteStream(user, streamType);

    // ensures peers are using last stream & tracks available
    this.updatePeersStream(stream, streamType);

    debug(`createPeerCall: call in progress`, { user: user._id, streamType });
  },

  async createPeerCalls(user) {
    const { shareAudio, shareScreen, shareVideo } = Meteor.user().profile;

    if (!this.calls[`${user._id}-${streamTypes.main}`] && !this.calls[`${user._id}-${streamTypes.screen}`]) {
      audioManager.play('webrtc-in.mp3', 0.2);
      notify(user, `Wants to talk to you`);

      if (!this.hasActiveStreams() && !this.discussionStartDate) {
        this.discussionStartDate = new Date();
        Meteor.call('analyticsDiscussionAttend', { users_attending_count: userProximitySensor.nearUsersCount() });
      }
    }

    const peer = await this.getPeer();
    if (shareAudio || shareVideo) userStreams.createStream().then(stream => this.createPeerCall(peer, user, stream, streamTypes.main));
    if (shareScreen) userStreams.createScreenStream().then(stream => this.createPeerCall(peer, user, stream, streamTypes.screen));
  },

  destroy() {
    this.closeAll();
    userStreams.destroyStream(streamTypes.main);
    this.peerInstance?.destroy();
    this.remoteStreamsByUsers.set([]);
    delete this.peerInstance;
  },

  updatePeersStream(stream, type) {
    debug('updatePeersStream: start', { stream, type });

    if (type === streamTypes.main) {
      debug(`updatePeersStream: main stream ${stream.id}`, { stream });
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      // note: to add a track it is necessary to renegotiate the connection with the remote user (https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack)
      _.each(this.calls, (call, key) => {
        if (key.indexOf('-screen') !== -1) return;
        const senders = call.peerConnection.getSenders();

        const existingSenderAudioTrack = senders.find(sender => sender.track.kind === 'audio');
        if (existingSenderAudioTrack) existingSenderAudioTrack.replaceTrack(audioTrack);
        else call.peerConnection.addTrack(audioTrack);

        const existingSenderVideoTrack = senders.find(sender => sender.track.kind === 'video');
        if (existingSenderVideoTrack) existingSenderVideoTrack.replaceTrack(videoTrack);
        else call.peerConnection.addTrack(videoTrack);

        if (!existingSenderAudioTrack || !existingSenderVideoTrack) debug(`updatePeersStream: stream main track added for user`, { key });
        else debug(`updatePeersStream: stream main track updated for user`, { key });
      });
    } else if (type === streamTypes.screen) {
      debug(`updatePeersStream: screen share stream ${stream.id}`, { stream });
      const screenTrack = stream.getVideoTracks()[0];

      _.each(this.calls, (call, key) => {
        if (key.indexOf('-screen') === -1) return;
        const senders = call.peerConnection.getSenders();
        let trackUpdated = false;

        senders.forEach(sender => {
          if (sender.track.id === screenTrack.id || sender.track.kind !== 'video') return;
          sender.replaceTrack(screenTrack);
          trackUpdated = true;
        });

        if (trackUpdated) debug(`updatePeersStream: stream main track updated for user ${key}`);
      });
    }
  },

  onProximityStarted(nearUsers) {
    if (!this.isEnabled()) return;

    const user = Meteor.user();
    if (user?.profile.guest) return; // disable proximity sensor for guest user

    nearUsers.forEach(nearUser => {
      const zone = zoneManager.currentZone(nearUser);
      if (zone?.disableCommunications) {
        lp.notif.warning(`${nearUser.profile.name} isn't available at the moment.<br /> Leave him a voice message by pressing "P"`);
        return;
      }

      this.cancelCallClose(nearUser._id);
      this.cancelCallOpening(nearUser._id);
      this.callsOpening[nearUser._id] = setTimeout(() => this.createPeerCalls(nearUser), Meteor.settings.public.peer.callDelay);
    });
  },

  onProximityEnded(users) {
    users.forEach(user => {
      if (this.lockedCalls[user._id]) return;
      this.close(user._id, Meteor.settings.public.peer.delayBeforeClosingCall, 'proximity-ended');
    });
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

  async sendData(userIds, data) {
    userIds = userIds.filter(Boolean); // remove falsy values
    if (!userIds.length) throw new Error(`no users targeted`);

    const peer = await this.getPeer();
    userIds.forEach(userId => {
      try {
        const connection = peer.connect(userId);

        connection.on('open', () => {
          connection.send(data);

          // Not sure if we must close the connection for now
          setTimeout(() => connection.close(), 500);
        });

        connection.on('error', () => {
          const user = Meteor.users.findOne(userId);
          if (user) lp.notif.warning(`${user.profile.name} was unavailable`);
          else lp.notif.warning(`${userId} is offline`);
        });
      } catch (err) {
        const user = Meteor.users.findOne(userId);
        lp.notif.error(`An error has occured during connection with ${user?.profile.name || userId}`);
      }
    });

    return userIds.length;
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
        avatar: generateRandomAvatarURLForUser(user),
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
    debug(`answerCall: start`, { userId: remoteUserId, type: remoteCall.metadata.type });
    if (!this.enabled) { debug(`answerCall: peer is disabled`); return false; }

    if (!remoteUserId) { debug(`answerCall: incomplete metadata for the remote call`); return false; }
    const remoteUser = Meteor.users.findOne({ _id: remoteUserId });
    if (!remoteUser) { debug(`answerCall: user not found "${remoteUserId}"`); return false; }

    // Send global notification
    sendEvent('proximity-started', { user: remoteUser });

    // answer the call
    remoteCall.answer();

    const callIdentifier = `${remoteUserId}-${remoteCall.metadata.type}`;
    this.remoteCalls[callIdentifier] = remoteCall;

    // show the remote call with an empty stream
    this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type);

    // update call's with stream received
    remoteCall.on('stream', stream => {
      debug(`remoteCall: received stream`, { userId: remoteUserId, type: remoteCall.metadata.type, stream: stream.id });
      this.createOrUpdateRemoteStream(remoteUser, remoteCall.metadata.type, stream);
    });

    remoteCall.on('close', () => {
      debug(`remoteCall: closed`, { userId: remoteUserId, type: remoteCall.metadata.type });
      this.close(remoteUserId, 0, 'peerjs-event');
    });

    return true;
  },

  async getPeer() {
    debug('getPeer: start');
    if (this.isPeerValid(this.peerInstance)) {
      debug('getPeer: return peer instance…', { instance: this.peerInstance });
      return this.peerInstance;
    }

    if (this.peerInstance?.disconnected) {
      let reconnected = true;
      try {
        debug('getPeer: peer disconnected, reconnecting…');
        this.peerInstance.reconnect();
      } catch (err) { reconnected = false; }

      // peerjs reconnect doesn't offer a promise or callback so we have to wait a certain time until the reconnection is done
      if (reconnected) {
        try {
          debug('getPeer: reconnected, waiting for instance');
          await waitFor(() => this.isPeerValid(this.peerInstance), 5, 250);
        } catch {
          this.destroy();
          lp.notif.error('Unable to reconnect to the peer server');
        }

        return this.peerInstance;
      }
    }

    if (!this.peerInstance && this.peerLoading) {
      try {
        debug('getPeer: loading, waiting for instance');
        await waitFor(() => this.peerInstance !== undefined, 5, 250);
      } catch {
        this.destroy();
        lp.notif.error('Unable to get a valid peer instance');
      }

      return this.peerInstance;
    }

    debug('getPeer: peer invalid, creating new peer…');
    this.peerInstance = undefined;
    this.peerLoading = false;

    return this.createMyPeer().catch(error => lp.notif.error(error.message));
  },

  async createMyPeer(skipConfig = false) {
    if (this.isPeerValid(this.peerInstance)) return this.peerInstance;
    if (!Meteor.user()) throw new Error(`an user is required to create a peer`);
    if (Meteor.user().profile.guest) throw new Error(`peer is forbidden for guest account`);

    this.peerLoading = true;
    const result = await meteorCall('getPeerConfig');

    const { port, url: host, path, config } = result;

    const peerConfig = {
      debug: Meteor.user().options?.debug ? 2 : 0,
      host,
      port,
      path,
      config,
    };

    if (skipConfig) delete peerConfig.config;
    if (this.peerInstance) this.destroy();
    this.peerInstance = new Peer(Meteor.userId(), peerConfig);
    this.peerLoading = false;

    debug(`createMyPeer: created`, { peerInstanceId: this.peerInstance.id });

    this.peerInstance.on('connection', connection => connection.on('data', data => userManager.onPeerDataReceived(data)));

    this.peerInstance.on('close', () => {
      debug('createMyPeer: peer closed');
      this.peerInstance = undefined;
    });

    this.peerInstance.on('error', peerErr => {
      if (['server-error', 'network'].includes(peerErr.type) && this.peerInstance.disconnected) this.peerInstance.reconnect();
      else if (peerErr.type === 'unavailable-id') lp.notif.error(`It seems that lemverse is already open in another tab (unavailable-id)`);
      else if (peerErr.type === 'peer-unavailable') {
        const userId = peerErr.message.split(' ').pop();
        const user = Meteor.users.findOne(userId);
        lp.notif.warning(`User ${user?.profile.name || userId} was unavailable`);
      } else lp.notif.error(`Peer ${peerErr} (${peerErr.type})`);

      debug(`peer error ${peerErr.type}`, peerErr);
    });

    this.peerInstance.on('call', remoteCall => {
      debug(`Incoming call`, { userId: remoteCall.metadata.userId });
      if (meet.api) {
        debug(`Call ignored (meet is open)`, { userId: remoteCall.metadata.userId, type: remoteCall.metadata.type });
        return;
      }

      this.answerCall(remoteCall);
    });

    return this.peerInstance;
  },

  lockCall(userId, notify = false) {
    if (notify && !this.lockedCalls[userId]) this.sendData([userId], { type: 'followed', emitter: Meteor.userId() });
    this.lockedCalls[userId] = true;
  },

  unlockCall(userId, notify = false) {
    if (notify && this.lockedCalls[userId]) this.sendData([userId], { type: 'unfollowed', emitter: Meteor.userId() });
    delete this.lockedCalls[userId];
  },

  hasActiveStreams() {
    return this.remoteStreamsByUsers.get().length;
  },

  isPeerValid(peer) {
    return peer?.id && !peer.disconnected;
  },

  enableSensor(value) {
    if (value === this.sensorEnabled) return;
    this.sensorEnabled = value;
    if (this.sensorEnabled) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  isEnabled() {
    return this.sensorEnabled && !meet.api;
  },
};
