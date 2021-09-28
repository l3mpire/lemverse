Template.profile.helpers({
  profile() { 
    const profile = Meteor.users.findOne(Session.get('displayProfile'))?.profile;
    return profile;
  },
});
Template.profile.events({
  'click .js-close-button'() {
    Session.set('displayProfile', false);
  },
});
