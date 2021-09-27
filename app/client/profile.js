Template.profile.helpers({
  profile() { 
    const profile = Meteor.users.findOne(Session.get('displayProfile'))?.profile;
    console.log('profile', profile)
    return profile;
  },
});
Template.profile.events({
  'click .js-close-button'() {
    console.log('close');
    Session.set('displayProfile', false);
  },
});
