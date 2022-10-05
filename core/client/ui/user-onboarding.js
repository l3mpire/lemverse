const ONBOARDING_LAST_STEP = 3;
const keyboards = ['q', 'z', 's', 'd', 'up', 'down', 'right', 'left'];
const isMobile = window.innerWidth < 480;

const getDirectionFromKey = key => {
  switch (key) {
    case 'z':
    case 'up':
      return 'up';
    case 's':
    case 'down':
      return 'down';
    case 'q':
    case 'left':
      return 'left';
    case 'd':
    case 'right':
      return 'right';
    default:
      return null;
  }
};


const requestUserMedia = async () => {
  const constraints = userStreams.getStreamConstraints(streamTypes.main);
  const stream = await userStreams.requestUserMedia(constraints);
  if (!stream) { lp.notif.error(`unable to get a valid stream`); return; }

  Session.set('streamAccepted', true);

  // We should stop the stream directly after asking permissions, since we just want to check if the user has granted permissions
  userStreams.destroyStream(streamTypes.main);
};

const bindKeyboards = () => {
  keyboards.forEach(key => {
    hotkeys(key, { keyup: true }, event => {
      if (event.repeat) return;

      const learnedDirections = Session.get('learnedDirections') || [];

      if (event.type === 'keydown') {
        const direction = getDirectionFromKey(key);

        if (!learnedDirections.includes(direction)) learnedDirections.push(direction);

        Session.set('learnedDirections', learnedDirections);
        Session.set('pressedKeyboard', key);
      } else {
        Session.set('pressedKeyboard', null);
      }
    });
  });
};

const finishOnboarding = () => {
  Meteor.users.update(Meteor.userId(), { $unset: { 'profile.guest': true } });

  lp.notif.success('Enjoy 🚀');
};


Template.userOnboarding.onCreated(async () => {
  await requestUserMedia();
  bindKeyboards();
});

Template.userOnboarding.events({
  'click .button'() {
    const onboardingStep = Session.get('onboardingStep') || 1;

    if (onboardingStep === (!isMobile ? ONBOARDING_LAST_STEP : ONBOARDING_LAST_STEP - 1)) {
      finishOnboarding();
    } else {
      Session.set('onboardingStep', onboardingStep + 1);
    }
  },
});

Template.userOnboarding.helpers({
  streamAccepted: () => Session.get('streamAccepted') || false,
  step: () => Session.get('onboardingStep') || 1,
  pressedKeyboard: () => Session.get('pressedKeyboard') || null,
  hasLearnedDirection: key => {
    const learnedDirections = Session.get('learnedDirections') || [];
    return learnedDirections.includes(getDirectionFromKey(key));
  },
  hasLearnedAllDirections: () => {
    const learnedDirections = Session.get('learnedDirections') || [];
    return learnedDirections.length === 4;
  },
  direction: () => getDirectionFromKey(Session.get('pressedKeyboard')),
  getAvatarUrl: () => {
    const user = Meteor.user();
    if (!user) return [];

    return `/api/files/${Object.keys(charactersParts).filter(part => user.profile[part]).map(part => Characters.findOne(user.profile[part]))[0].fileId}`;
  },
  isMobile: () => isMobile,
});
