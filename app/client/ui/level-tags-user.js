const removeUserFromTag = (userId, tag) => {
  if (!userId || !tag) return;

  const { levelId } = Meteor.user().profile;
  Levels.update(levelId, { $pull: { [`userTags.${tag}`]: userId } });
};

Template.levelTagsUser.events({
  'click .js-remove-user'() { removeUserFromTag(this.user, this.tag); },
});

Template.levelTagsUser.helpers({
  name() {
    return Meteor.users.findOne(this.user)?.profile.name;
  },
});
