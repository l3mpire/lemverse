// https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe

meet = {
  api: undefined,

  toggleFullscreen() {
    this.fullscreen($('#game').width() > $('#meet').width());
  },

  fullscreen(value) {
    const meetElement = $('#meet');

    if (!value) {
      meetElement.removeClass('fullscreen');
    } else {
      meetElement.addClass('fullscreen');
    }
  },

  open(roomName = Meteor.settings.public.meet.roomDefaultName) {
    if (meet.api) return;

    const options = {
      roomName,
      width: '100%',
      height: '100%',
      parentNode: document.querySelector('#meet'),
      userInfo: {
        email: Meteor.user().emails[0].address,
        displayName: Meteor.user().profile.name,
      },
    };

    meet.api = new window.JitsiMeetExternalAPI(Meteor.settings.public.meet.serverURL, options);
    $('#meet').addClass('show');

    peer.destroy();
    userProximitySensor.callProximityEndedForAllNearUsers();

    if (window.electron) {
      const { setupScreenSharingRender } = window.electron.jitsiMeetElectronUtils;
      setupScreenSharingRender(meet.api);
    }
  },

  close() {
    if (meet.api) { meet.api.dispose(); meet.api = undefined; }
    $('#meet').removeClass('show');
  },

  mute() {
    meet.api.isAudioMuted().then(muted => {
      if (muted) return;
      meet.api.executeCommand('toggleAudio');
    });
  },

  unmute() {
    meet.api.isAudioMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleAudio');
    });
  },

  hide() {
    meet.api.isVideoMuted().then(muted => {
      if (muted) return;
      meet.api.executeCommand('toggleVideo');
    });
  },

  unhide() {
    meet.api.isVideoMuted().then(muted => {
      if (!muted) return;
      meet.api.executeCommand('toggleVideo');
    });
  },
};
