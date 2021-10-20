const mainSettings = 'settingsMain';
const characterSettings = 'settingsCharacter';
const mediasSettings = 'settingsMedias';
const menus = [characterSettings, mediasSettings];

Template.settings.events({
  'click .js-go-back'() {
    Session.set('displaySettings', mainSettings);
  },
  'click .js-character-designer'() {
    Session.set('displaySettings', characterSettings);
  },
  'click .js-medias-settings'() {
    Session.set('displaySettings', mediasSettings);
  },
  'click .js-profile'() {
    Session.set('displayProfile', Meteor.userId());
  },
});

Template.settings.helpers({
  mode() {
    if (menus.includes(Session.get('displaySettings'))) return Session.get('displaySettings');
    return mainSettings;
  },
});
