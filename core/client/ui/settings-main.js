Template.settingsMain.onCreated(() => {
  Session.set('activeSettingsPage', 'settingsBasic');
});

Template.settingsMain.helpers({
  activePage() { return Session.get('activeSettingsPage') || 'settingsBasic'; },
});

Template.settingsMain.events({
  'click .js-logout'(event) {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    Meteor.logout();
  },
  'click .js-menu-entry'(event) { Session.set('activeSettingsPage', event.currentTarget.dataset.page); },
});
