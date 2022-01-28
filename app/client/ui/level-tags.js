const currentLevel = () => Levels.findOne(Meteor.user().profile.levelId);

const currentLevelTags = () => currentLevel()?.userTags || {};

const removeTag = tag => {
  const tags = currentLevelTags();
  if (!tags[tag]) {
    lp.notif.error('Tag not found');
    return;
  }

  lp.notif.confirm('Tag deletion', `Are you sure to delete the tag "<b>${tag}</b> (${tags[tag].length} users concerned)"?`, () => {
    const { levelId } = Meteor.user().profile;
    Levels.update(levelId, { $unset: { [`userTags.${tag}`]: 1 } });
  });
};

Template.levelTag.events({
  'click .js-remove-tag'() { removeTag(this.tag); },
});

Template.levelTag.helpers({
  users() {
    return currentLevelTags()[this.tag] || [];
  },
  color() {
    return stringToColor(this.tag);
  },
});

Template.levelTags.helpers({
  allLevelTags() { return Object.keys(currentLevelTags()); },
});
