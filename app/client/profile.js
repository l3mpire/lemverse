const isEditionAllowed = () => Session.get('displayProfile') === Meteor.userId();

const formatURL = url => {
  let formattedURL;
  try {
    formattedURL = new URL(url);
  } catch (err) {
    try {
      formattedURL = new URL(`https://${url}`);
    } catch (error) {
      lp.notif.error('invalid website URL');
    }
  }

  return formattedURL;
};

Template.profile.onCreated(function () {
  Tracker.autorun(() => {
    const userId = Session.get('displayProfile');
    if (userId) this.subscribe('userProfile', userId);
  });
});

Template.profile.helpers({
  title() { return Meteor.users.findOne(Session.get('displayProfile'))?.profile.name; },
  profile() {
    const user = Meteor.users.findOne(Session.get('displayProfile'));
    if (!user) {
      Session.set('displayProfile', null);
      return undefined;
    }

    return user.profile;
  },
  age() {
    const user = Meteor.users.findOne(Session.get('displayProfile'));
    if (!user) {
      Session.set('displayProfile', null);
      return undefined;
    }

    return moment().diff(user.createdAt, 'days');
  },
  editionAllowed() { return isEditionAllowed(); },
  website() {
    const { website } = Meteor.users.findOne(Session.get('displayProfile')).profile;
    if (!website) return null;

    const url = formatURL(website);
    return url.href;
  },
});

Template.profile.events({
  'click .js-close-button'() {
    Session.set('displayProfile', null);
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
  'blur .js-website'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;

    if (value) {
      const url = formatURL(value);
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.website': url.href } });
    } else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.website': 1 } });

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
