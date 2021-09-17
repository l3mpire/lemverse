const checkEmail = value => {
  if (!value) return 'Who are you mister anonymous? 🤔';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email';

  return true;
};

const checkNickname = value => (!value ? 'A nickname is required' : true);

const checkPassword = value => {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Your password must have at least 8 characters';
  if (value.length < 10 && value.replace(/[a-z]/gm, '').length < 3) return 'Your password should be more than 9 characters or contains at least 3 special characters (numbers, upper case characters or symbols)';

  return true;
};

const onSubmit = template => {
  const step = template.step.get();

  // Check form values
  let checkedResult = true;
  if (step === 2) checkedResult = checkEmail(template.email);
  else if (step === 3) checkedResult = checkPassword(template.password);
  else if (step === 4) checkedResult = checkNickname(template.nickname);
  if (checkedResult !== true) { lp.notif.error(checkedResult); return; }

  if (step < 4) {
    template.step.set(step + 1);

    // auto-focus first input on each step
    Tracker.afterFlush(() => document.querySelector('.form-account form input')?.focus());
  } else {
    Meteor.call('convertGuestAccountToRealAccount', template.email, template.nickname, template.password, err => {
      if (err) {
        lp.notif.error(err.reason);
        template.step.set(2); // go back to the first step with a field

        return;
      }

      hotkeys.setScope(scopes.player);
      game.scene.keys.WorldScene.playerUpdate(Meteor.user());
      peer.createMyPeer();
    });
  }
};

Template.formSignIn.onCreated(function () {
  this.step = new ReactiveVar(1);
  this.email = undefined;
  this.password = undefined;
  this.nickname = undefined;
});

Template.formSignIn.events({
  'click .js-next-step'() { onSubmit(Template.instance()); },
  'focus input'() { hotkeys.setScope('form'); game?.scene?.keys?.WorldScene?.enableKeyboard(false, false); },
  'blur input'() { hotkeys.setScope(scopes.player); game?.scene?.keys?.WorldScene?.enableKeyboard(true, false); },
  'click .js-previous-step'() { Template.instance().step.set(Template.instance().step.get() - 1); },
  'change .js-email'(e) { Template.instance().email = e.target.value; },
  'change .js-password'(e) { Template.instance().password = e.target.value; },
  'change .js-nickname'(e) { Template.instance().nickname = e.target.value; },
  'submit form'(e) {
    e.preventDefault();
    e.stopPropagation();

    onSubmit(Template.instance());

    return false;
  },
});

Template.formSignIn.helpers({
  email() { return Template.instance().email; },
  nickname() { return Template.instance().nickname; },
  password() { return Template.instance().password; },
  getStep() { return Template.instance().step.get(); },
});
