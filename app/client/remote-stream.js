const maxAttempt = 10;
const delayBetweenAttempt = 2000; // in ms
const talkingDetectorThreshold = 10;

const isRemoteUserSharingMedia = (user, type) => (type === streamTypes.screen ? user.shareScreen : user.shareAudio || user.shareVideo);

const addVolumeAudioContextProcessor = (stream, triggerVar) => {
  const audioContext = new AudioContext();
  const mediaStreamSource = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(2048, 1, 1);

  mediaStreamSource.connect(audioContext.destination);
  mediaStreamSource.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = e => {
    const inputData = e.inputBuffer.getChannelData(0);
    const inputDataLength = inputData.length;
    let total = 0;

    for (let i = 0; i < inputDataLength; i++) total += Math.abs(inputData[i++]);

    const rms = Math.sqrt(total / inputDataLength);
    triggerVar.set(rms * 100 >= talkingDetectorThreshold);
  };
};

const checkMediaAvailable = (template, type) => {
  const { remoteUser } = template.data;
  if (!remoteUser._id) {
    log(`Missing user id in template data`);
    return;
  }

  const remoteUserIsNear = remoteStreamsByUsers.get().find(usr => usr._id === remoteUser._id);
  if (!remoteUserIsNear) {
    log(`Stop retry to get ${remoteUser.name}'s ${type}, ${remoteUser.name} is too far`);
    return;
  }

  const user = Meteor.users.findOne({ _id: remoteUser._id }).profile;
  if (!isRemoteUserSharingMedia(user, type)) {
    log(`Remote user has nothing to share`);
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

  if (lp.isLemverseBeta('talkIndicator')) {
    const stream = this.data.remoteUser.main?.srcObject;
    if (stream) addVolumeAudioContextProcessor(stream, this.data.triggerVar);
  }
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

Template.remoteStream.helpers({
  mediaState() { return Meteor.users.findOne({ _id: this.remoteUser._id })?.profile; },
  hasMainStream() { return this.remoteUser.main?.srcObject; },
  hasScreenStream() { return this.remoteUser.screen?.srcObject; },
  state() {
    const user = Meteor.users.findOne({ _id: this.remoteUser._id });
    if (!user) return 'user-error';

    const { profile } = user;
    if (profile.userMediaError) return 'media-error';

    return this.remoteUser.waitingCallAnswer ? 'calling' : 'connected';
  },
  isTalking() { return Template.instance().talking.get(); },
  talkingVar() { return Template.instance().talking; },
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
