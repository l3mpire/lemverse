const screenShareDefaultConfig = {
  defaultFrameRate: 5,
  maxFrameRate: 30,
};

const videoDefaultConfig = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 20 },
};

streamTypes = Object.freeze({
  main: 'main',
  screen: 'screen',
});

userStreams = {
  streams: {
    main: {
      instance: undefined,
      loading: false,
    },
    screen: {
      instance: undefined,
      loading: false,
    },
  },

  audio(enabled) {
    this.streams.main.instance?.getAudioTracks().forEach(track => { track.enabled = enabled; });
  },

  video(enabled) {
    this.streams.main.instance?.getVideoTracks().forEach(track => { track.enabled = enabled; });
  },

  screen(enabled) {
    const { instance: screenStream } = this.streams.screen;
    if (screenStream && !enabled) {
      this.stopTracks(screenStream);
      this.streams.screen.instance = undefined;
      _.each(peer.calls, (call, key) => {
        if (key.indexOf('-screen') === -1) return;
        if (Meteor.user().options?.debug) log('me -> you screen ****** I stop sharing screen, call closing', key);
        call.close();
        delete peer.calls[key];
      });
    } else if (enabled) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  destroyStream(type) {
    const debug = Meteor.user()?.options?.debug;
    const { instance: stream } = type === streamTypes.main ? this.streams.main : this.streams.screen;
    if (debug) log('destroyStream: start', { stream, type });
    if (!stream) {
      if (debug) log('destroyStream: cancelled (stream was not alive)');
      return;
    }

    this.stopTracks(stream);

    if (stream === this.streams.main.instance) this.streams.main.instance = undefined;
    else if (stream === this.streams.screen.instance) this.streams.screen.instance = undefined;
  },

  async requestUserMedia(constraints = {}) {
    const debug = Meteor.user().options?.debug;

    if (debug) log('requestUserMedia: start');
    if (constraints.forceNew) this.destroyStream(streamTypes.main);

    const { instance: currentStream, loading } = this.streams.main;
    if (currentStream) {
      if (debug) log('requestUserMedia: stream already active');
      return currentStream;
    }

    if (!currentStream && loading) {
      try {
        if (debug) log('requestUserMedia: waiting existing stream to load…');
        await waitFor(() => this.streams.main.instance !== undefined, 15, 500);
        return this.streams.main.instance;
      } catch {
        lp.notif.error(`Unable to access the camera and microphone after few attempts`);
      }
    }

    this.streams.main.loading = true;
    let stream;
    try {
      if (debug) log('requestUserMedia: stream is loading');
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      error('requestUserMedia failed', err);
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': err.message } });
      if (err.message === 'Permission denied') lp.notif.warning('Camera and microphone are required 😢');
      else if (err.message === 'Permission denied by system') lp.notif.warning('Unable to access the camera and microphone');

      throw err;
    } finally { this.streams.main.loading = false; }

    if (debug) log('requestUserMedia: stream created', { streamId: stream.id });
    this.streams.main.instance = stream;
    window.dispatchEvent(new CustomEvent(eventTypes.onMediaStreamStateChanged, { detail: { type: streamTypes.main, state: 'ready', stream } }));
    Meteor.users.update(Meteor.userId(), { $unset: { 'profile.userMediaError': 1 } });

    return stream;
  },

  async requestDisplayMedia() {
    const debug = Meteor.user().options?.debug;
    if (debug) log('requestDisplayMedia: start');

    const { instance: currentStream, loading } = this.streams.screen;
    if (currentStream) return currentStream;
    if (!currentStream && loading) {
      try {
        if (debug) log('requestDisplayMedia: waiting existing stream to load…');
        await waitFor(() => this.streams.screen.instance !== undefined, 20, 1000);
        return this.streams.screen.instance;
      } catch {
        lp.notif.error(`Unable to access screen after few attempts`);
      }
    }

    this.streams.screen.loading = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(this.getStreamConstraints(streamTypes.screen));
    } catch (err) {
      error('requestDisplayMedia failed', err);
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
      throw err;
    } finally { this.streams.screen.loading = false; }

    if (debug) log('requestDisplayMedia: stream created', { streamId: stream.id });
    this.streams.screen.instance = stream;
    window.dispatchEvent(new CustomEvent(eventTypes.onMediaStreamStateChanged, { detail: { type: streamTypes.screen, state: 'ready', stream } }));

    // detect cancel action from the browser UI
    stream.getVideoTracks()[0].onended = () => Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });

    return stream;
  },

  async createStream(forceNew = false) {
    const constraints = this.getStreamConstraints(streamTypes.main);
    constraints.forceNew = forceNew;

    const { cams } = await this.enumerateDevices();
    if (cams.length === 0) delete constraints.video;

    // todo: allow streams without video flag to avoid camera's light on mac (should delete the property options.video)
    // if (!shareVideo) delete constraints.video;

    const stream = await this.requestUserMedia(constraints);
    if (!stream) throw new Error(`unable to get a valid stream`);

    // ensures tracks are up-to-date
    const { shareVideo, shareAudio } = Meteor.user().profile;
    this.audio(shareAudio);
    this.video(shareVideo);

    return stream;
  },

  async createScreenStream() {
    const stream = await this.requestDisplayMedia();
    if (!stream) throw new Error('Unable to get a display media');

    // set framerate after stream creation due to a deprecated constraints issue with the frameRate attribute
    this.applyConstraints(streamTypes.screen, 'video', this.getStreamConstraints(streamTypes.screen));

    return stream;
  },

  applyConstraints(streamType, trackType, constraints) {
    const { instance: stream } = streamType === streamTypes.main ? this.streams.main : this.streams.screen;
    if (!stream) return;
    const tracks = trackType === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  getStreamConstraints(type) {
    const { videoRecorder, audioRecorder, screenShareFrameRate } = Meteor.user().profile;
    const constraints = {};

    if (type === streamTypes.main) {
      constraints.audio = { deviceId: audioRecorder };
      constraints.video = { deviceId: videoRecorder, ...videoDefaultConfig };
    } else {
      const { defaultFrameRate, maxFrameRate } = screenShareDefaultConfig;

      constraints.audio = false;
      constraints.video = {
        frameRate: {
          ideal: +screenShareFrameRate || defaultFrameRate,
          max: maxFrameRate,
        },
      };
    }

    return constraints;
  },

  stopTracks(stream) {
    stream?.getTracks().forEach(track => track.stop());
  },

  shouldCreateNewStream(streamType, needAudio, needVideo) {
    const { instance: stream } = streamType === streamTypes.main ? this.streams.main : this.streams.screen;

    if (!stream) return true;
    if (needAudio && !stream.getAudioTracks().length) return true;
    if (needVideo && !stream.getVideoTracks().length) return true;

    return false;
  },

  async enumerateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const mics = [];
    const cams = [];
    devices.forEach(device => {
      if (device.kind === 'audioinput') mics.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
      else if (device.kind === 'videoinput') cams.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
    });

    return { mics, cams };
  },
};
