const maxAttempt = 10;
const delayBetweenAttempt = 2000; // in ms

const isRemoteUserSharingMedia = (user, type) => (type === 'screen' ? user.shareScreen : user.shareAudio || user.shareVideo);

const checkMediaAvailable = (template, type) => {
  if (!template.data?._id) {
    log(`Missing user id in template data`);
    return;
  }

  const remoteUserIsNear = remoteStreamsByUsers.get().find(usr => usr._id === template.data._id);
  if (!remoteUserIsNear) {
    log(`Stop retry to get ${template.data?.name}'s ${type}, ${template.data?.name} is too far`);
    return;
  }

  const remoteUser = Meteor.users.findOne({ _id: template.data._id })?.profile;
  if (!isRemoteUserSharingMedia(remoteUser, type)) {
    log(`Remote user has nothing to share`);
    return;
  }

  const source = type === 'screen' ? template.data.screen?.srcObject : template.data.user?.srcObject;
  if (source) {
    template.firstNode.srcObject = source;
    template.firstNode.play().catch(() => {
      error(`unable to player remote user's media: playback interrupted (${template.data._id}) : ${template.attempt}`);
      setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
    });
  } else if (template.attempt < maxAttempt) {
    template.attempt++;
    log(`Tried to get ${template.data?.name}'s ${type} and failed, attempt : ${template.attempt}`);
    setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
  } else {
    error(`unable to get user's ${type}`);
  }
};

Template.webcam.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'video-audio');
});

Template.screenshare.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'screen');
});

Template.remoteStream.helpers({
  mediaState() { return Meteor.users.findOne({ _id: this.remoteUser._id })?.profile; },
  hasWebcamOrMicro(webcam, micro) { return webcam || micro; },
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
