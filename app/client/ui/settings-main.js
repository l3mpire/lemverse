Template.characterNameColorSelector.helpers({
  nameColors() { return Object.keys(characterNameColors); },
  isSelected(value) { return Meteor.user().profile.nameColor === value; },
});

Template.settingsMain.events({
  'input .js-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    const name = event.target.value.trim();
    if (!name) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.name': name } });
    userManager.rename(name, Meteor.user().profile.nameColor);
  },
  'input .js-name-color'(event) {
    event.preventDefault();
    event.stopPropagation();
    const color = event.target.value;
    if (!color) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.nameColor': color } });
    userManager.rename(Meteor.user().profile.name, color);
  },
  'input .js-reaction'(event) {
    event.preventDefault();
    event.stopPropagation();
    const reaction = event.target.value.trim();
    if (!reaction) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.defaultReaction': reaction } });
  },
  'click .js-copy-invitation'(event) {
    event.preventDefault();
    event.stopPropagation();

    const { levelId } = Meteor.user().profile;
    const levelIdWithoutPrefix = levelId.substring(levelId.lastIndexOf('_') + 1);

    const path = FlowRouter.path('invite', { levelId: levelIdWithoutPrefix });
    const url = `${window.location.protocol}//${window.location.host}${path}`;
    navigator.clipboard.writeText(url).then(() => lp.notif.success('✂️ Invitation copied to your clipboard'));
  },
  'click .js-logout'(event) {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    Meteor.logout();
  },
});

Template.settingsMain.events({
  'click .js-inventory'() { Session.set('modal', { template: 'inventory', append: true }); },
  'click .js-character-designer'() { Session.set('modal', { template: 'settingsCharacter', append: true }); },
  'click .js-medias-settings'() { Session.set('modal', { template: 'settingsMedias', append: true }); },
  'click .js-profile'() { Session.set('modal', { template: 'profile', userId: Meteor.userId(), append: true }); },
  'click .js-password'() { Session.set('modal', { template: 'settingsPassword', userId: Meteor.userId(), append: true }); },
});
