import { toggleUIInputs } from '../helpers';

const RETRY_DELAY = 10; // seconds

const onPasswordRecoverSubmit = template => {
  const { email } = template;
  if (!email) { lp.notif.error('Who are you mister anonymous? 🤔'); return; }

  Accounts.forgotPassword({ email }, err => {
    if (err && err.message !== 'User not found [403]') {
      lp.notif.error(err.message);
      return;
    }

    lp.notif.success('You should receive an email shortly if the address belongs to an existing account 🙂');
    template.loginMode.set(true);
  });
};

const startRetryCountdown = template => {
  if (template.countdown) {
    clearInterval(template.countdown);
  }
  template.counter.set(RETRY_DELAY);
  template.countdown = setInterval(() => {
    template.counter.set(template.counter.get() - 1);
    if (template.counter.get() === 0) {
      clearInterval(template.countdown);
    }
  }, 1000);
};

const passwordlessLogin = template => {
  const options = {
    selector: template.email,
    options: { userCreationDisabled: true },
  };
  Accounts.requestLoginTokenForUser(options, err => {
    if (err && err.message !== 'User not found [403]') {
      lp.notif.error(err.message);
      return;
    }
    template.emailSent.set(true);
    startRetryCountdown(template);
  });
};

const onSubmit = template => {
  const { email, password } = template;
  if (!email) { lp.notif.error('Who are you mister anonymous? 🤔'); return; }
  if (!template.loginMode.get()) { onPasswordRecoverSubmit(template); return; }
  if (Meteor.settings.public.passwordless) { passwordlessLogin(template); return; }
  if (!password) { lp.notif.error(`Hey! I need your password... Promise, I won't share it with anyone 🤐`); return; }

  const {
    x: ghostX,
    y: ghostY,
    direction: ghostDirection,
    levelId: ghostLevelId,
  } = Meteor.user().profile;

  Meteor.loginWithPassword(email, password, err => {
    if (err) { lp.notif.error('Incorrect login or password'); return; }

    const user = Meteor.user();
    if (user.profile.levelId === ghostLevelId) {
      Meteor.users.update(user._id, {
        $set: {
          'profile.x': ghostX,
          'profile.y': ghostY,
          'profile.direction': ghostDirection,
        },
      });
    }

    toggleUIInputs(false);
  });
};

Template.formLogIn.onCreated(function () {
  this.email = undefined;
  this.password = undefined;
  this.loginMode = new ReactiveVar(true);
  this.emailSent = new ReactiveVar(false);
  this.counter = new ReactiveVar(RETRY_DELAY);
  this.countdown = undefined;
});

Template.formLogIn.events({
  'click .js-next-step'() { onSubmit(Template.instance()); },
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
  contactURL() { return Meteor.settings.public.permissions?.contactURL; },
  emailSent() { return Template.instance().emailSent.get(); },
  counter() { return Template.instance().counter.get(); },
  canRetry() { return !!Template.instance().counter.get(); },
});
