const screenShareDefaultConfig = {
  defaultFrameRate: 5,
  maxFrameRate: 30,
};

const videoDefaultConfig = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 20 },
};

const debug = (text, meta) => {
  if (!Meteor.user({ fields: { 'options.debug': 1 } })?.options?.debug) return;
  log(text, meta);
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
    if (!screenStream || enabled) return;

    this.stopTracks(screenStream);
    this.streams.screen.instance = undefined;
    Object.entries(peer.calls).forEach(([key, call]) => {
      if (key.indexOf('-screen') === -1) return;
      debug('me -> you screen ****** I stop sharing screen, call closing', key);
      call.close();
      delete peer.calls[key];
    });
  },

  destroyStream(type) {
    const { instance: stream } = type === streamTypes.main ? this.streams.main : this.streams.screen;
    debug('destroyStream: start', { stream, type });
    if (!stream) {
      debug('destroyStream: cancelled (stream was not alive)');
      return;
    }

    this.stopTracks(stream);

    if (stream === this.streams.main.instance) this.streams.main.instance = undefined;
    else if (stream === this.streams.screen.instance) this.streams.screen.instance = undefined;
  },

  async requestUserMedia(constraints = {}) {
    debug('requestUserMedia: start', { constraints });
    if (constraints.forceNew) this.destroyStream(streamTypes.main);

    const { instance: currentStream, loading } = this.streams.main;
    if (currentStream) {
      debug('requestUserMedia: stream already active');
      return currentStream;
    }

    if (!currentStream && loading) {
      try {
        debug('requestUserMedia: waiting existing stream to load…');
        await waitFor(() => this.streams.main.instance !== undefined, 15, 500);
        return this.streams.main.instance;
      } catch {
        lp.notif.error(`Unable to access the camera and microphone after few attempts`);
      }
    }

    this.streams.main.loading = true;
    let stream;
    try {
      debug('requestUserMedia: stream is loading');
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      error('requestUserMedia failed', err);
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': err.message } });
      if (err.name === 'NotAllowedError') {
        if (err.message === 'Permission denied by system') lp.notif.warning('Unable to access the camera and microphone');
        else lp.notif.warning(`You have not authorized your browser to use your camera and microphone 😢`);
      } else if (err.name === 'OverconstrainedError') {
        lp.notif.warning('Cameras constraints not supported');
        debug('requestUserMedia: invalid constraints', constraints);
      }

      throw err;
    } finally { this.streams.main.loading = false; }

    debug('requestUserMedia: stream created', { streamId: stream.id, constraints });
    this.streams.main.instance = stream;
    window.dispatchEvent(new CustomEvent(eventTypes.onMediaStreamStateChanged, { detail: { type: streamTypes.main, state: 'ready', stream } }));
    Meteor.users.update(Meteor.userId(), { $unset: { 'profile.userMediaError': 1 } });

    return stream;
  },

  async requestDisplayMedia() {
    debug('requestDisplayMedia: start');

    const { instance: currentStream, loading } = this.streams.screen;
    if (currentStream) return currentStream;
    if (!currentStream && loading) {
      try {
        debug('requestDisplayMedia: waiting existing stream to load…');
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

      if (err.name === 'NotAllowedError') {
        if (err.message === 'Permission denied by system') lp.notif.warning('Permission denied by system');
        else lp.notif.warning(`You have not authorized your browser to share your screen`);
      }

      throw err;
    } finally { this.streams.screen.loading = false; }

    debug('requestDisplayMedia: stream created', { streamId: stream.id });
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
    const { shareVideo, shareAudio } = Meteor.user({ 'profile.shareVideo': 1, 'profile.shareAudio': 1 }).profile;
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

  generateFakeMediaStream() {
    const silence = () => {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const dst = oscillator.connect(ctx.createMediaStreamDestination());
      oscillator.start();

      return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    const black = ({ width = 280, height = 180 } = {}) => {
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      const context = canvas.getContext('2d');
      context.fillRect(0, 0, width, height);

      const stream = canvas.captureStream();
      return Object.assign(stream.getVideoTracks()[0], { enabled: true });
    };

    return new MediaStream([black(), silence()]);
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
