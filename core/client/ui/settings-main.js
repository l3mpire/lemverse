const getDefaultActivePage = () => (Meteor.settings.public.permissions.allowProfileEdition ? 'settingsBasic' : 'settingsCharacter');

Template.settingsMain.onCreated(() => {
  Session.set('activeSettingsPage', getDefaultActivePage());
});

Template.settingsMain.helpers({
  activePage() { return Session.get('activeSettingsPage') || getDefaultActivePage(); },
  allowProfileEdition() { return Meteor.settings.public.permissions.allowProfileEdition; },
  helpURL() { return Meteor.settings.public.lp.helpURL; },
  passwordless() { return Meteor.settings.public.passwordless; },
});

Template.settingsMain.events({
  'click .js-logout'(event) {
    event.preventDefault();
    event.stopPropagation();
    lp.notif.confirm('Logout', `You will be disconnected from ${Meteor.settings.public.lp.product}, are you sure ?`, () => {
      Meteor.logout(() => {
        closeModal();
      });
    });
  },
  'click .js-menu-entry'(event) { Session.set('activeSettingsPage', event.currentTarget.dataset.page); },
});
