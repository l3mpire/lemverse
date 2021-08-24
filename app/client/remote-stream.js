const maxAttempt = 10;
const delayBetweenAttempt = 2000; // in ms

Template.webcam.onRendered(function () {
  let attempt = 1;
  const checkMediaAvailable = () => {
    if (this.data?._id) {
      const remoteUser = Meteor.users.findOne({ _id: this.data._id })?.profile;
      const remoteUserIsNear = remoteStreamsByUsers.get().find(usr => usr._id === this.data._id);

      if (!remoteUserIsNear) {
        log(`Stop retry to get ${this.data?.name}'s audio & video, ${this.data?.name} is too far`);
        return;
      }

      if (remoteUser.shareAudio || remoteUser.shareVideo) {
        if (this.data?.user?.srcObject) {
          this.firstNode.srcObject = this.data.user.srcObject;

          this.firstNode.play().catch(() => {
            error(`unable to player remote user's media: playback interrupted (${this.data._id}) : ${attempt}`);
            setTimeout(checkMediaAvailable, delayBetweenAttempt);
          });
        } else if (attempt < maxAttempt) {
          attempt++;
          log(`Tried to get ${this.data?.name}'s audio and/or video and failed, attempt : ${attempt}`);
          setTimeout(checkMediaAvailable, delayBetweenAttempt);
        } else {
          error(`unable to get user's medias`);
        }
      }
    }
  };
  checkMediaAvailable();
});

Template.screenshare.onRendered(function () {
  let attempt = 1;
  const checkMediaAvailable = () => {
    if (this.data?._id) {
      const remoteUser = Meteor.users.findOne({ _id: this.data._id })?.profile;
      const allRemoteStreamsByUsers = remoteStreamsByUsers.get();
      const remoteUserIsNear = allRemoteStreamsByUsers.find(usr => usr._id === this.data._id);

      if (!remoteUserIsNear) {
        log(`Stop retry to get ${this.data?.name}'s screenshare, ${this.data?.name} is too far`);
        return;
      }
      if (remoteUser.shareScreen) {
        if (this.data?.screen?.srcObject) {
          this.firstNode.srcObject = this.data?.screen?.srcObject;
        } else if (attempt < maxAttempt) {
          attempt++;
          log(`Tried to get ${this.data?.name}'s screenshare and failed, attempt : ${attempt}`);
          setTimeout(checkMediaAvailable, delayBetweenAttempt);
        } else {
          error(`unable to get user screenshare media`);
        }
      }
    }
  };
  checkMediaAvailable();
});

Template.remoteStream.helpers({
  mediaState() {
    const user = Meteor.users.findOne({ _id: this.remoteUser._id })?.profile;
    return user;
  },
  hasWebcamOrMicro(webcam, micro) {
    return webcam || micro;
  },
});

Template.remoteStream.events({
  'click .js-webcam'(e) {
    e.preventDefault();
    const full = $(e.target).hasClass('fullscreen');
    $('.fullscreen').removeClass('fullscreen');
    if (!full) $(e.target).addClass('fullscreen');
  },
  'click .js-screenshare'(e) {
    e.preventDefault();
    const full = $(e.target).hasClass('fullscreen');
    $('.fullscreen').removeClass('fullscreen');
    if (!full) $(e.target).addClass('fullscreen');
  },
});
