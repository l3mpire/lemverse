const defaultTab = 'teamSettingsBasic';

Template.teamSettingsMain.helpers({
  activePage() { return Session.get('activeTeamSettingsPage') || defaultTab; },
  teamModules() { return Session.get('teamModules') || []; },
});

Template.teamSettingsMain.events({
  'click .js-menu-entry'(event) { Session.set('activeTeamSettingsPage', event.currentTarget.dataset.page); },
});
