myStream = undefined;
myScreenStream = undefined;

userStreams = {
  streamLoading: false,
  screenStreamLoading: false,
  screenSharingDefaultFrameRate: 22,
  videoElement: undefined,

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

  destroyStream(stream) {
    if (!stream) return;

    const debug = Meteor.user()?.options?.debug;
    if (debug) log('destroy stream: start', stream.id);
    this.stopTracks(stream);

    const userVideo = this.getVideoElement();
    destroyVideoSource(userVideo);
    this.getVideoElement()?.classList.toggle('active', false);

    if (stream === myStream) myStream = undefined;
    else if (stream === myScreenStream) myScreenStream = undefined;

    if (debug) log('destroy stream: done');
  },

  requestUserMedia(forceNew = false) {
    if (forceNew) this.destroyStream(myStream);
    if (myStream) return new Promise(resolve => resolve(myStream));
    if (!myStream && this.streamLoading) return waitFor(() => myStream !== undefined, 10, 500).then(() => myStream);

    const { shareVideo, shareAudio, videoRecorder, audioRecorder } = Meteor.user().profile;
    this.streamLoading = true;

    const options = {
      video: { deviceId: shareVideo && videoRecorder || false, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { max: 30 } },
      audio: { deviceId: shareAudio && audioRecorder || false },
    };

    return navigator.mediaDevices
      .getUserMedia(options)
      .then(stream => {
        this.destroyStream(myStream);

        if (Meteor.user()?.options?.debug) log('create stream', stream.id);
        myStream = stream;
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': false } });

        return stream;
      })
      .catch(err => {
        error('requestUserMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.userMediaError': true } });
        if (err.message === 'Permission denied') lp.notif.warning('Camera and microphone are required 😢');
        return Promise.reject(err);
      })
      .finally(() => { this.streamLoading = false; });
  },

  requestDisplayMedia() {
    if (myScreenStream) return new Promise(resolve => resolve(myScreenStream));
    if (!myScreenStream && this.screenStreamLoading) return waitFor(() => myScreenStream !== undefined, 20, 1000).then(() => myScreenStream);

    const { screenShareFrameRate } = Meteor.user().profile;
    this.screenStreamLoading = true;

    return navigator.mediaDevices
      .getDisplayMedia({ frameRate: { ideal: screenShareFrameRate || this.screenSharingDefaultFrameRate, max: 30 } })
      .then(stream => { myScreenStream = stream; return stream; })
      .catch(err => {
        error('requestDisplayMedia failed', err);
        Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareScreen': false } });
        return Promise.reject(err);
      })
      .finally(() => { this.screenStreamLoading = false; });
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

  applyConstraints(stream, type, constraints) {
    if (!stream) return;
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => track.applyConstraints(constraints));
  },

  getVideoElement() {
    if (!this.videoElement) this.videoElement = document.querySelector('.js-video-me video');
    return this.videoElement;
  },
};
