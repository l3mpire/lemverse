import Peer from 'peerjs';
import audioManager from './audio-manager';
import meetingRoom from './meeting-room';
import { canAnswerCall, meteorCallWithPromise } from './helpers';
import { guestAllowed, permissionTypes } from '../lib/misc';

const debug = (text, meta) => {
  if (!Meteor.user({ fields: { 'options.debug': 1 } })?.options?.debug) return;
  log(text, meta);
};

const callAction = Object.freeze({
  open: 0,
  close: 1,
});

peer = {
  calls: {},
  waitingCallActions: {},
  callStartDates: {},
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

    Tracker.autorun(() => {
      const user = Meteor.user({ fields: { 'status.idle': 1 } });
      if (!user) return;

      this.enableSensor(!user.status.idle);
    });

    // For security reasons we periodically check that the users in discussion are still close to the calling users
    window.setInterval(() => {
      const callEntries = Object.entries(this.remoteCalls);
      if (!callEntries.length) return;

      callEntries.forEach(entry => {
        // Keep the call if user is near or in follow mode
        const _id = entry[1].metadata.userId;
        if (userProximitySensor.isUserNear({ _id }) || this.lockedCalls[_id]) return;
        this.closeCall(_id, 0, 'security-user-far');
      });
    }, this.securityCheckInterval);

    // Listen device connection/disconnection to update peers
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      if (!this.hasActiveStreams()) return;

      const constraints = userStreams.getStreamConstraints(streamTypes.main);
      constraints.forceNew = true;

      const stream = await userStreams.requestUserMedia(constraints);
      if (!stream) { lp.notif.error(`unable to get a valid stream`); return; }

      peer.updatePeersStream(stream, streamTypes.main);
    });
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
    const _close = (remote, user, type) => {
      const callsSource = remote ? this.remoteCalls : this.calls;
      const call = callsSource[`${user}-${type}`];
      if (call) {
        activeCallsCount++;
        call.close();
      }

      delete callsSource[`${user}-${type}`];
    };

    this.unlockCall(userId, true);
    _close(false, userId, streamTypes.main);
    _close(false, userId, streamTypes.screen);
    _close(true, userId, streamTypes.main);
    _close(true, userId, streamTypes.screen);
    this.cancelWaitingCallAction(userId);

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
    }

    if (this.callStartDates[userId]) {
      const duration = (Date.now() - this.callStartDates[userId]) / 1000;
      Meteor.call('analyticsDiscussionEnd', { peerUserId: userId, duration, usersAttendingCount: this.getCallCount() });
      delete this.callStartDates[userId];
    }

    $(`.js-video-${userId}-user`).remove();
    debug('closeCall: call closed successfully', { userId });

    if (!activeCallsCount) return;

    const { file, volume } = Meteor.settings.public.peer.sounds.hangUp;
    audioManager.play(file, volume);
  },

  close(userId, timeout = 0, origin = null) {
    debug(`close: start (${origin})`, { userId });
    if (this.isCallInState(userId, callAction.close)) {
      debug(`close: call already closing (action ignored)`, { userId });
      return;
    }

    this.cancelWaitingCallAction(userId);
    this.waitingCallActions[userId] = {
      timer: setTimeout(() => {
        this.cancelWaitingCallAction(userId);
        this.closeCall(userId, origin);
      }, timeout),
      action: callAction.close,
    };
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
      const { file, volume } = Meteor.settings.public.peer.sounds.incomingCall;
      audioManager.play(file, volume);
      notify(user, `Wants to talk to you`);

      if (!this.callStartDates[user._id]) {
        this.callStartDates[user._id] = Date.now();
        Meteor.call('analyticsDiscussionAttend', { peerUserId: user._id, usersAttendingCount: this.getCallCount() });
      }
    }

    const peer = await this.getPeer();
    if (!peer) {
      debug(`createPeerCalls: peer not created`);
      return;
    }

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

    const callEntries = Object.entries(this.calls);

    if (type === streamTypes.main) {
      debug(`updatePeersStream: main stream ${stream.id}`, { stream });
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      // note: to add a track it is necessary to renegotiate the connection with the remote user (https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack)
      callEntries.forEach(([key, call]) => {
        if (key.indexOf('-screen') !== -1) return;
        const senders = call.peerConnection.getSenders();

        const existingSenderAudioTrack = senders.find(sender => sender.track.kind === 'audio');
        if (existingSenderAudioTrack) {
          if (audioTrack) existingSenderAudioTrack.replaceTrack(audioTrack);
          else call.peerConnection.removeTrack(existingSenderAudioTrack);
        } else if (audioTrack) call.peerConnection.addTrack(audioTrack);

        const existingSenderVideoTrack = senders.find(sender => sender.track.kind === 'video');
        if (existingSenderVideoTrack) {
          if (videoTrack) existingSenderVideoTrack.replaceTrack(videoTrack);
          else call.peerConnection.removeTrack(existingSenderVideoTrack);
        } else if (videoTrack) call.peerConnection.addTrack(videoTrack);

        if (!existingSenderAudioTrack || !existingSenderVideoTrack) debug(`updatePeersStream: stream main track added for user`, { key });
        else debug(`updatePeersStream: stream main track updated for user`, { key });
      });
    } else if (type === streamTypes.screen) {
      debug(`updatePeersStream: screen share stream ${stream.id}`, { stream });
      const screenTrack = stream.getVideoTracks()[0];

      callEntries.forEach(([key, call]) => {
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
    if (!this.isEnabled() && this.sensorEnabled) return;

    nearUsers.forEach(nearUser => {
      if (nearUser.profile.guest && !guestAllowed(permissionTypes.talkToUsers)) return;
      if (this.isCallInState(nearUser._id, callAction.open)) return;
      this.cancelWaitingCallAction(nearUser._id);

      const zone = zoneManager.currentZone(nearUser);
      if (zone?.disableCommunications) {
        lp.notif.warning(`${nearUser.profile.name} isn't available at the moment.<br /> Leave him a voice message by pressing "P"`);
        return;
      }

      this.waitingCallActions[nearUser._id] = {
        timer: setTimeout(() => {
          this.cancelWaitingCallAction(nearUser._id);
          this.createPeerCalls(nearUser);
        }, Meteor.settings.public.peer.callDelay),
        action: callAction.open,
      };
    });
  },

  onProximityEnded(users) {
    users.forEach(user => {
      if (this.lockedCalls[user._id]) return;
      this.close(user._id, Meteor.settings.public.peer.delayBeforeClosingCall, 'proximity-ended');
    });
  },

  isCallInState(userId, state) {
    return this.waitingCallActions[userId]?.action === state;
  },

  cancelWaitingCallAction(userId) {
    if (!this.waitingCallActions[userId]) return;
    clearTimeout(this.waitingCallActions[userId].timer);
    delete this.waitingCallActions[userId];
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

    const user = Meteor.user();
    if (!user) throw new Error(`an user is required to create a peer`);
    if (user.profile.guest && !guestAllowed(permissionTypes.talkToUsers)) throw new Error(`You need an account to talk to other users`);

    this.peerLoading = true;
    const result = await meteorCallWithPromise('getPeerConfig');

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
      else if (peerErr.type === 'unavailable-id') lp.notif.error(`It seems that ${Meteor.settings.public.lp.product} is already open in another tab (unavailable-id)`);
      else if (peerErr.type === 'peer-unavailable') {
        const userId = peerErr.message.split(' ').pop();
        const userUnavailable = Meteor.users.findOne(userId);
        lp.notif.warning(`User ${userUnavailable?.profile.name || userId} was unavailable`);
      } else lp.notif.error(`Peer ${peerErr} (${peerErr.type})`);

      debug(`peer error ${peerErr.type}`, peerErr);
    });

    this.peerInstance.on('call', remoteCall => {
      debug(`Incoming call`, { userId: remoteCall.metadata.userId });
      if (meetingRoom.isOpen()) {
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

  getCallCount() {
    return Object.keys(this.callStartDates).length;
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
    return this.enabled && !meetingRoom.isOpen();
  },
};
