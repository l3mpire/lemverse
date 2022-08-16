const maxAttempt = 10;
const delayBetweenAttempt = 2000; // in ms

const findRemoteUser = userId => Meteor.users.findOne(userId,
  { fields: {
    'profile.userMediaError': 1,
    'profile.shareAudio': 1,
    'profile.shareVideo': 1,
  } });

const removeAllFullScreenElement = ignoredElement => {
  document.querySelectorAll('.stream .fullscreen').forEach(stream => {
    if (stream.parentElement !== ignoredElement) stream.classList.remove('fullscreen');
  });
};

const updatePhaserMouseInputState = () => {
  const hasStreamInFullScreen = document.querySelectorAll('.stream .fullscreen').length;
  game.scene.getScene('WorldScene')?.enableMouse(!hasStreamInFullScreen);
};

const checkMediaAvailable = (template, type) => {
  const { remoteUser } = template.data;
  if (!remoteUser._id) {
    log(`Missing user id in template data`);
    return;
  }

  const remoteUserIsNear = peer.remoteStreamsByUsers.get().find(usr => usr._id === remoteUser._id);
  if (!remoteUserIsNear) {
    log(`Stop retry to get ${remoteUser.name}'s ${type}, ${remoteUser.name} is too far`);
    return;
  }

  const source = type === streamTypes.screen ? remoteUser.screen?.srcObject : remoteUser.main?.srcObject;
  if (source) {
    template.firstNode.srcObject = source;
    template.firstNode.play().catch(() => {
      error(`unable to player remote user's media: playback interrupted (${remoteUser._id}) : ${template.attempt}`);
      setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
    });
  } else if (template.attempt < maxAttempt) {
    template.attempt++;
    log(`Tried to get ${remoteUser.name}'s ${type} and failed, attempt : ${template.attempt}`);
    setTimeout(() => checkMediaAvailable(template, type), delayBetweenAttempt);
  } else {
    error(`unable to get user's ${type}`);
  }
};

Template.webcam.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'video-audio');
});

Template.webcam.onDestroyed(function () {
  destroyVideoSource(this.find('video'));
});

Template.screenshare.onRendered(function () {
  this.attempt = 1;
  checkMediaAvailable(this, 'screen');
});

Template.screenshare.onDestroyed(function () {
  destroyVideoSource(this.find('video'));
});

Template.remoteStream.onCreated(function () {
  this.talking = new ReactiveVar(false);
});

Template.remoteStream.onDestroyed(() => {
  if (!isModalOpen()) game.scene.getScene('WorldScene')?.enableMouse(true);
});

Template.remoteStream.helpers({
  mediaState() { return findRemoteUser(this.remoteUser._id)?.profile; },
  hasMainStream() { return this.remoteUser.main?.srcObject; },
  hasScreenStream() { return this.remoteUser.screen?.srcObject; },
  state() {
    const user = findRemoteUser(this.remoteUser._id);
    if (!user) return 'user-error';
    if (user.profile.userMediaError) return 'media-error';

    return this.remoteUser.waitingCallAnswer ? 'calling' : 'connected';
  },
  isTalking() { return Template.instance().talking.get(); },
  talkingVar() { return Template.instance().talking; },
});

Template.remoteStream.events({
  'click .stream video, click .stream img'(event) {
    event.preventDefault();

    const { target } = event;
    removeAllFullScreenElement(target);
    target.classList.toggle('fullscreen');

    updatePhaserMouseInputState();
  },
  'click .js-webcam, click .js-screenshare'(event) {
    event.preventDefault();
    const { target } = event;

    removeAllFullScreenElement(target);

    const child = target.querySelector('video, img');
    child?.classList.toggle('fullscreen');

    updatePhaserMouseInputState();
  },
});
