Template.settings.events({
  'click .js-character-designer'() {
    Session.set('settingsMode', 'character');
  },
  'click .js-medias-settings'() {
    Session.set('settingsMode', 'medias');
  },
  'click .js-close-button'() {
    if (Session.get('settingsMode') !== 'default') Session.set('settingsMode', 'default');
    else Session.set('displaySettings', false);
  },
  'input .js-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    const name = event.target.value;
    if (!name) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.name': name } });
    userManager.rename(name);
    return false;
  },
  'input .js-reaction'(event) {
    event.preventDefault();
    event.stopPropagation();

    const reaction = event.target.value;
    if (!reaction) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.defaultReaction': reaction } });
    return false;
  },
  'input .js-position'(event) {
    event.preventDefault();
    event.stopPropagation();
    const position = event.target.value;
    if (!position) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.position': position } });
    return false;
  },
  'input .js-social'(event) {
    event.preventDefault();
    event.stopPropagation();
    const social = event.target.value;
    if (!social) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.social': social } });
    return false;
  },
  'input .js-bio'(event) {
    event.preventDefault();
    event.stopPropagation();
    const bio = event.target.value;
    if (!bio) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.bio': bio } });
    return false;
  },
  'input .js-website'(event) {
    event.preventDefault();
    event.stopPropagation();
    const website = event.target.value;
    if (!website) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.website': website } });
    return false;
  },
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
  },
});
