const screenShareDefaultConfig = {
  defaultFrameRate: 5,
  maxFrameRate: 30,
};

const videoDefaultConfig = {
  width: { ideal: 320, max: 320 },
  height: { ideal: 240, max: 240 },
  frameRate: { max: 20 },
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
      domElement: undefined,
    },
    screen: {
      instance: undefined,
      loading: false,
      domElement: undefined,
    },
  },

  audio(enabled) {
    if (!this.streams.main.instance) return;
    _.each(this.streams.main.instance.getAudioTracks(), track => { track.enabled = enabled; });
  },

  video(enabled) {
    const { instance: mainStream } = this.streams.main;
    this.getVideoElement().parentElement.classList.toggle('active', mainStream && enabled);
    if (mainStream?.getVideoTracks().length) _.each(mainStream.getVideoTracks(), track => { track.enabled = enabled; });
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

      const divElm = document.querySelector('.js-video-screen-me');
      divElm.srcObject = undefined;
      divElm.style.display = 'none';
      document.querySelectorAll('.js-video-screen-me video').forEach(v => {
        destroyVideoSource(v);
        v.remove();
      });
    } else if (enabled) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  destroyStream(type) {
    const { instance: stream } = type === streamTypes.main ? this.streams.main : this.streams.screen;
    if (!stream) return;

    const debug = Meteor.user()?.options?.debug;
    if (debug) log('destroy stream: start', stream.id);
    this.stopTracks(stream);

    const userVideo = this.getVideoElement();
    destroyVideoSource(userVideo);

    if (stream === this.streams.main.instance) {
      this.streams.main.instance = undefined;
      userVideo.parentElement.classList.toggle('active', false);
      userVideo.parentElement.style.backgroundImage = '';
    } else if (stream === this.streams.screen.instance) this.streams.screen.instance = undefined;

    if (debug) log('destroy stream: done');
  },

  requestUserMedia(constraints = {}) {
    if (constraints.forceNew) this.destroyStream(streamTypes.main);
    const { instance: currentStream, loading } = this.streams.main;
    if (currentStream) return new Promise(resolve => resolve(currentStream));
    if (!currentStream && loading) return waitFor(() => this.streams.main.instance !== undefined, 15, 500).then(() => this.streams.main.instance);

    this.streams.main.loading = true;
    return navigator.mediaDevices
      .getUserMedia(constraints)
      .then(stream => {
        this.destroyStream(streamTypes.main);

        if (Meteor.user()?.options?.debug) log('create stream', stream.id);
        this.streams.main.instance = stream;
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': false } });

        return stream;
      })
      .catch(err => {
        error('requestUserMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': true } });
        if (err.message === 'Permission denied') lp.notif.warning('Camera and microphone are required 😢');
        if (err.message === 'Permission denied by system') lp.notif.warning('Unable to access the camera and microphone');

        return Promise.reject(err);
      })
      .finally(() => { this.streams.main.loading = false; });
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

  requestDisplayMedia() {
    const { instance: currentStream, loading } = this.streams.screen;
    if (currentStream) return new Promise(resolve => resolve(currentStream));
    if (!currentStream && loading) return waitFor(() => this.streams.screen.instance !== undefined, 20, 1000).then(() => this.streams.screen.instance);

    this.streams.screen.loading = true;
    return navigator.mediaDevices
      .getDisplayMedia(this.getStreamConstraints(streamTypes.screen))
      .then(stream => { this.streams.screen.instance = stream; return stream; })
      .catch(err => {
        error('requestDisplayMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
        return Promise.reject(err);
      })
      .finally(() => { this.streams.screen.loading = false; });
  },

  createStream(forceNew = false) {
    const { shareVideo, shareAudio } = Meteor.user().profile;
    const constraints = this.getStreamConstraints(streamTypes.main);
    constraints.forceNew = forceNew;

    return this.enumerateDevices().then(({ cams }) => {
      if (cams.length === 0) delete constraints.video;

      // todo: allow streams without video flag to avoid camera's light on mac (should delete the property options.video)
      // if (!shareVideo) delete constraints.video;

      return this.requestUserMedia(constraints)
        .then(stream => {
          if (!stream) return Promise.reject(new Error(`unable to get a valid stream`));

          // sync video element with the stream
          const videoElement = this.getVideoElement();
          if (stream.id !== videoElement.srcObject?.id) videoElement.srcObject = stream;
          videoElement.parentElement.style.backgroundImage = `url('${videoElement.parentElement.dataset.avatar}')`;

          // ensures tracks are up-to-date
          this.audio(shareAudio);
          this.video(shareVideo);

          return stream;
        });
    });
  },

  createScreenStream() {
    return this.requestDisplayMedia()
      .then(stream => {
        if (!stream) return undefined;

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

        return stream;
      });
  },

  applyConstraints(streamType, trackType, constraints) {
    const { instance: stream } = streamType === streamTypes.main ? this.streams.main : this.streams.screen;
    if (!stream) return;
    const tracks = trackType === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  stopTracks(stream) {
    if (!stream) return;
    _.each(stream.getTracks(), track => track.stop());
  },

  shouldCreateNewStream(streamType, needAudio, needVideo) {
    const { instance: stream } = streamType === streamTypes.main ? this.streams.main : this.streams.screen;

    if (!stream) return true;
    if (needAudio && stream.getAudioTracks().length === 0) return true;
    if (needVideo && stream.getVideoTracks().length === 0) return true;

    return false;
  },

  getVideoElement() {
    if (!this.streams.main.domElement) {
      this.streams.main.domElement = document.querySelector('.js-video-me video');
      this.refreshVideoElementAvatar();
    }

    return this.streams.main.domElement;
  },

  refreshVideoElementAvatar() {
    const videoElement = this.getVideoElement();
    videoElement.parentElement.dataset.avatar = getRandomAvatarForUser(Meteor.user());
    if (this.streams.main.instance) videoElement.parentElement.style.backgroundImage = `url('${videoElement.parentElement.dataset.avatar}')`;
  },

  enumerateDevices() {
    return navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = [];
      const cams = [];
      devices.forEach(device => {
        if (device.kind === 'audioinput') mics.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
        if (device.kind === 'videoinput') cams.push({ deviceId: device.deviceId, kind: device.kind, label: device.label });
      });

      return { mics, cams };
    });
  },
};
