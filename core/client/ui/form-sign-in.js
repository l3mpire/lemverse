import { toggleUIInputs } from '../helpers';

const checkEmail = value => {
  if (!value) return 'Who are you mister anonymous? 🤔';
  if (!/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(value)) return 'Invalid email';

  return true;
};

const checkNickname = value => (!value ? 'A nickname is required' : true);

const checkPassword = value => {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Your password must have at least 8 characters';
  if (value.length < 10 && value.replace(/[a-z]/gm, '').length < 3) return 'Your password should be more than 9 characters or contains at least 3 special characters (numbers, upper case characters or symbols)';

  return true;
};

const nextStep = template => {
  const step = template.step.get();
  if (Meteor.settings.public.passwordless && step === 2) {
    template.step.set(4);
  } else {
    template.step.set(step + 1);
  }
};

const previousStep = template => {
  const step = template.step.get();
  if (Meteor.settings.public.passwordless && step === 4) {
    template.step.set(2);
  } else {
    template.step.set(step - 1);
  }
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
    nextStep(template);

    // auto-focus first input on each step
    Tracker.afterFlush(() => document.querySelector('.form-account form input')?.focus());
  } else {
    const source = FlowRouter.getRouteName() === 'invite' ? 'invite' : 'self';
    Meteor.call('convertGuestAccountToRealAccount', template.email, template.nickname, template.password, source, err => {
      if (err) {
        lp.notif.error(err.reason);
        template.step.set(2); // go back to the first step with a field

        return;
      }

      toggleUIInputs(false);
    });
  }
};

Template.formSignIn.onCreated(function () {
  this.step = new ReactiveVar(1);
  this.email = undefined;
  this.password = Meteor.settings.public.passwordless ? '' : undefined;
  this.nickname = undefined;
});

Template.formSignIn.events({
  'click .js-next-step'() { onSubmit(Template.instance()); },
  'click .js-previous-step'() { previousStep(Template.instance()); },
  'keyup .js-email'(event, templateInstance) { templateInstance.email = event.target.value; },
  'keyup .js-password'(event, templateInstance) { templateInstance.password = event.target.value; },
  'keyup .js-nickname'(event, templateInstance) { templateInstance.nickname = event.target.value; },
  'submit form'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();
    onSubmit(templateInstance);

    return false;
  },
});

Template.formSignIn.helpers({
  email() { return Template.instance().email; },
  nickname() { return Template.instance().nickname; },
  password() { return Template.instance().password; },
  getStep() { return Template.instance().step.get(); },
  termsLink() { return Meteor.settings.public.tos.terms; },
  cookiesLink() { return Meteor.settings.public.tos.cookies; },
  privacyLink() { return Meteor.settings.public.tos.privacy; },
});
