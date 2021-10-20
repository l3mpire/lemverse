const isEditionAllowed = () => Session.get('displayProfile') === Meteor.userId();

Template.profile.onCreated(function () {
  this.subscribe('userProfile', Session.get('displayProfile'));
});

Template.profile.helpers({
  title() { return Meteor.users.findOne(Session.get('displayProfile'))?.profile.name; },
  profile() {
    const user = Meteor.users.findOne(Session.get('displayProfile'));
    if (!user) {
      Session.set('displayProfile', false);
      return undefined;
    }

    return user.profile;
  },
  age() {
    const user = Meteor.users.findOne(Session.get('displayProfile'));
    if (!user) {
      Session.set('displayProfile', false);
      return undefined;
    }

    return moment().diff(user.createdAt, 'days');
  },
  editionAllowed() { return isEditionAllowed(); },
  hasWebsite() { return !!Meteor.users.findOne(Session.get('displayProfile')).profile.website; },
});

Template.profile.events({
  'click .js-close-button'() {
    Session.set('displayProfile', false);
  },
  'input .js-company'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.company.name': value } });
    return false;
  },
  'input .js-position'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.company.position': value } });
    return false;
  },
  'input .js-website'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.website': value } });
    return false;
  },
  'input .js-bio'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.bio': value } });
    return false;
  },
});
