const getUser = template => Meteor.users.findOne(template.data.userId);

Template.profile.onCreated(function () {
  const { userId } = this.data;
  if (userId) this.subscribe('userProfile', userId);
});

Template.profile.helpers({
  title() { return getUser(Template.instance()).profile.name; },
  profile() { return getUser(Template.instance()).profile; },
  age() { return moment().diff(getUser(Template.instance()).createdAt, 'days'); },
  editionAllowed() { return Template.instance().data.userId === Meteor.userId(); },
  website() {
    const { website } = getUser(Template.instance()).profile;
    if (!website) return null;

    const url = formatURL(website);
    if (!url) return null;

    return url.href;
  },
});

Template.profile.events({
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
      if (!url) {
        lp.notif.error('invalid website URL');
        Meteor.users.update(Meteor.userId(), { $unset: { 'profile.website': 1 } });
        return null;
      }

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
  'input .js-avatar'(event) {
    event.preventDefault();
    event.stopPropagation();
    const avatar = event.target.value;
    if (!avatar) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.avatar': avatar } });
    return false;
  },
});
