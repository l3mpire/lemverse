const ONBOARDING_LAST_STEP = 2;

Template.userOnboarding.onCreated(async () => {
  const constraints = userStreams.getStreamConstraints(streamTypes.main);
  const stream = await userStreams.requestUserMedia(constraints);
  if (!stream) { lp.notif.error(`unable to get a valid stream`); return; }

  if (Session.get('sceneWorldReady')) {
    // We disable keyboard to not let the player move while onboarding
    const worldScene = game.scene.getScene('WorldScene');
    worldScene.enableKeyboard(false);
  }

  Session.set('streamAccepted', true);

  // We should stop the stream directly after asking permissions, since we just want to check if the user has granted permissions
  userStreams.destroyStream(streamTypes.main);
});

const finishOnboarding = () => {
  Meteor.users.update(Meteor.userId(), { $unset: { 'profile.guest': true } });

  const worldScene = game.scene.getScene('WorldScene');
  worldScene.enableKeyboard(true);
  lp.notif.success('Enjoy 🚀');
};

Template.userOnboarding.events({
  'click .continue-button'() {
    const onboardingStep = Session.get('onboardingStep') || 1;

    if (onboardingStep === ONBOARDING_LAST_STEP) {
      finishOnboarding();
    } else {
      Session.set('onboardingStep', onboardingStep + 1);
    }
  },
});

Template.userOnboarding.helpers({
  streamAccepted: () => Session.get('streamAccepted') || false,
  step: () => Session.get('onboardingStep') || 1,
});
