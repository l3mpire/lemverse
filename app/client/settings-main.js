Template.settingsMain.events({
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
  'input .js-avatar'(event) {
    event.preventDefault();
    event.stopPropagation();
    const avatar = event.target.value;
    if (!avatar) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.avatar': avatar } });
    return false;
  },
});
