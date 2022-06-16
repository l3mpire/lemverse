Template.formSignInLimited.helpers({
  contactURL() { return Meteor.settings.public.permissions?.contactURL; },
});
