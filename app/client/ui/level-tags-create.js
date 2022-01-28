const createTag = name => {
  if (name?.length < 3) {
    lp.notif.error(`The tag must have at least 3 characters`);
    return false;
  }

  const level = Levels.findOne(Meteor.user().profile.levelId);
  if (Object.keys(level.userTags).includes(name)) {
    lp.notif.error(`A tag with the name ${name} already exists`);
    return false;
  }

  Levels.update(level._id, { $set: { [`userTags.${name}`]: [] } });
  return true;
};

Template.levelTagsCreate.events({
  'click .js-create'() {
    const field = document.querySelector('.level-tags-create .js-tag-name');
    if (createTag(field.value)) field.value = '';
  },
});
