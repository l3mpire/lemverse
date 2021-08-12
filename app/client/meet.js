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
      configOverwrite: {
        // startWithAudioMuted: !mediaManager.constraintsMedia.audio,
        // startWithVideoMuted: mediaManager.constraintsMedia.video === false,
        prejoinPageEnabled: false,
      },
      userInfo: {
        email: Meteor.user().emails[0].address,
        displayName: Meteor.user().profile.name,
      },
      interfaceConfigOverwrite: {
        SHOW_CHROME_EXTENSION_BANNER: false,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        // Note: hiding brand does not seem to work, we probably need to put this on the server side.
        SHOW_BRAND_WATERMARK: false,
        SHOW_JITSI_WATERMARK: false,
        SHOW_POWERED_BY: false,
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        SHOW_WATERMARK_FOR_GUESTS: false,

        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', /* 'embedmeeting', */ 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', /* 'invite', */ 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone', /* 'security' */
        ],
      },
    };

    meet.api = new window.JitsiMeetExternalAPI(Meteor.settings.public.meet.serverURL, options);
    $('#meet').addClass('show');

    peer.closeAll();
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
