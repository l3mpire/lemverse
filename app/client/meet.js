// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe

meet = {
  api: undefined,
  node: undefined,

  open(roomName = Meteor.settings.public.meet.roomDefaultName) {
    if (meet.api) return;

    const options = {
      roomName,
      width: '100%',
      height: '100%',
      parentNode: this.nodeElement(),
      userInfo: {
        email: Meteor.user().emails[0].address,
        displayName: Meteor.user().profile.name,
      },
    };

    meet.api = new window.JitsiMeetExternalAPI(Meteor.settings.public.meet.serverURL, options);
    this.show(true);

    peer.disable();
    userProximitySensor.callProximityEndedForAllNearUsers();

    if (window.electron) {
      const { setupScreenSharingRender } = window.electron.jitsiMeetElectronUtils;
      setupScreenSharingRender(meet.api);
    }
  },

  close() {
    meet.api?.dispose();
    meet.api = undefined;
    this.show(false);
    peer.enable();
  },

  show(value) {
    this.nodeElement().classList.toggle('show', !!value);
  },

  fullscreen(value) {
    this.nodeElement().classList.toggle('fullscreen', !!value);
  },

  mute() {
    meet.api.isAudioMuted().then(muted => {
      if (muted) return;
      this.toggleAudio();
    });
  },

  unmute() {
    meet.api.isAudioMuted().then(muted => {
      if (!muted) return;
      this.toggleAudio();
    });
  },

  hide() {
    meet.api.isVideoMuted().then(muted => {
      if (muted) return;
      this.toggleVideo();
    });
  },

  unhide() {
    meet.api.isVideoMuted().then(muted => {
      if (!muted) return;
      this.toggleVideo();
    });
  },

  toggleAudio() {
    meet.api.executeCommand('toggleAudio');
  },

  toggleVideo() {
    meet.api.executeCommand('toggleVideo');
  },

  nodeElement() {
    if (!this.node) this.node = document.querySelector('#meet');
    return this.node;
  },
};
