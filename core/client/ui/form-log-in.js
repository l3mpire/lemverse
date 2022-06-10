const onPasswordRecoverSubmit = template => {
  const { email } = template;
  if (!email) { lp.notif.error('Who are you mister anonymous? 🤔'); return; }

  Accounts.forgotPassword({ email }, err => {
    if (err) {
      if (err.message === 'User not found [403]') lp.notif.error('Who are you mister anonymous? 🤔');
      else lp.notif.error(err.message);

      return;
    }

    lp.notif.success('An email has just been sent to you!');
    template.loginMode.set(true);
  });
};

const onSubmit = template => {
  const { email, password } = template;
  if (!email) { lp.notif.error('Who are you mister anonymous? 🤔'); return; }
  if (!template.loginMode.get()) { onPasswordRecoverSubmit(template); return; }
  if (!password) { lp.notif.error(`Hey! I need your password... Promise, I won't share it with anyone 🤐`); return; }

  const {
    x: ghostX,
    y: ghostY,
    direction: ghostDirection,
    levelId: ghostLevelId,
  } = Meteor.user().profile;

  Meteor.loginWithPassword(email, password, err => {
    if (err) { lp.notif.error('Incorrect login or password'); return; }

    if (Meteor.user().profile.levelId === ghostLevelId) {
      savePlayer({
        x: ghostX,
        y: ghostY,
        direction: ghostDirection,
      });
    }

    hotkeys.setScope(scopes.player);
  });
};

Template.formLogIn.onCreated(function () {
  this.email = undefined;
  this.password = undefined;
  this.loginMode = new ReactiveVar(true);
});

Template.formLogIn.events({
  'click .js-next-step'() { onSubmit(Template.instance()); },
  'focus input'() { hotkeys.setScope('form'); game?.scene?.keys?.WorldScene?.enableKeyboard(false, false); },
  'blur input'() { hotkeys.setScope(scopes.player); game?.scene?.keys?.WorldScene?.enableKeyboard(true, false); },
  'keyup .js-email'(event, templateInstance) { templateInstance.email = event.target.value; },
  'keyup .js-password'(event, templateInstance) { templateInstance.password = event.target.value; },
  'click .js-cancel-login-mode'() { Template.instance().loginMode.set(true); },
  'click .js-password-lost'() { Template.instance().loginMode.set(false); },
  'submit form'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    onSubmit(templateInstance);

    return false;
  },
});

Template.formLogIn.helpers({
  email() { return Template.instance().email; },
  password() { return Template.instance().password; },
  loginMode() { return Template.instance().loginMode.get(); },
});
