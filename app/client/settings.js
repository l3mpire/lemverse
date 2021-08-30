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
    game.scene.keys.WorldScene.playerRename(name);
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
  'change .js-mic-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.audioRecorder': event.target.value } });
  },
  'change .js-cam-select'(event) {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.videoRecorder': event.target.value } });
  },
});
