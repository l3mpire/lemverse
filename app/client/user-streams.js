const screenShareDefaultConfig = {
  defaultFrameRate: 22,
  maxFrameRate: 30,
};

const videoDefaultConfig = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { max: 30 },
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

  audio(enabled, notifyNearUsers = false) {
    if (!this.streams.main.instance) return;
    _.each(this.streams.main.instance.getAudioTracks(), track => { track.enabled = enabled; });
    if (enabled && notifyNearUsers) userProximitySensor.callProximityStartedForAllNearUsers();
  },

  video(enabled, notifyNearUsers = false) {
    const { instance: mainStream } = this.streams.main;
    this.getVideoElement()?.classList.toggle('active', mainStream && enabled);
    if (!mainStream) return;
    _.each(mainStream.getVideoTracks(), track => { track.enabled = enabled; });
    if (enabled && notifyNearUsers) userProximitySensor.callProximityStartedForAllNearUsers();
    if (mainStream.id !== this.getVideoElement().srcObject?.id) this.getVideoElement().srcObject = mainStream;
  },

  screen(enabled) {
    const { instance: screenStream } = this.streams.screen;
    if (screenStream && !enabled) {
      this.stopTracks(screenStream);
      this.streams.screen.instance = undefined;
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
      this.getVideoElement()?.classList.toggle('active', false);
    } else if (stream === this.streams.screen.instance) this.streams.screen.instance = undefined;

    if (debug) log('destroy stream: done');
  },

  requestUserMedia(forceNew = false) {
    if (forceNew) this.destroyStream(streamTypes.main);
    const { instance: currentStream, loading } = this.streams.main;
    if (currentStream) return new Promise(resolve => resolve(currentStream));
    if (!currentStream && loading) return waitFor(() => currentStream !== undefined, 10, 500).then(() => currentStream);

    const { shareVideo, shareAudio, videoRecorder, audioRecorder } = Meteor.user().profile;
    const options = {
      video: { deviceId: shareVideo && videoRecorder || false, ...videoDefaultConfig },
      audio: { deviceId: shareAudio && audioRecorder || false },
    };

    this.streams.main.loading = true;
    return navigator.mediaDevices
      .getUserMedia(options)
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
        return Promise.reject(err);
      })
      .finally(() => { this.streams.main.loading = false; });
  },

  requestDisplayMedia() {
    const { instance: currentStream, loading } = this.streams.screen;
    if (currentStream) return new Promise(resolve => resolve(currentStream));
    if (!currentStream && loading) return waitFor(() => currentStream !== undefined, 20, 1000).then(() => currentStream);

    const { screenShareFrameRate } = Meteor.user().profile;
    this.streams.screen.loading = true;
    return navigator.mediaDevices
      .getDisplayMedia({ frameRate: {
        ideal: screenShareFrameRate || screenShareDefaultConfig.defaultFrameRate,
        max: screenShareDefaultConfig.maxFrameRate },
      })
      .then(stream => { this.streams.screen.instance = stream; return stream; })
      .catch(err => {
        error('requestDisplayMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
        return Promise.reject(err);
      })
      .finally(() => { this.streams.screen.loading = false; });
  },

  createStream(forceNew = false) {
    return this.requestUserMedia(forceNew)
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
    const { instance: stream } = streamType === this.streams.main ? this.streams.main : this.streams.screen;
    if (!stream) return;
    const tracks = trackType === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  stopTracks(stream) {
    if (!stream) return;
    _.each(stream.getTracks(), track => track.stop());
  },

  getVideoElement() {
    if (!this.streams.main.domElement) this.streams.main.domElement = document.querySelector('.js-video-me video');
    return this.streams.main.domElement;
  },
};
