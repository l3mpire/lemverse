Template.settingsCharacter.onCreated(() => {
  if (!Session.get('settings-character-category')) Session.set('settings-character-category', 'body');
});

Template.settingsCharacter.helpers({
  getAllImages(category) {
    if (category === undefined) category = Session.get('settings-character-category');
    return Characters.find({ category: category, $or: [{ hide: { $exists: false } }, { hide: false }] }).fetch();
  },
  isBodyPart(id) {
    return Meteor.user().profile[Session.get('settings-character-category')] === id;
  },
  user() { return Meteor.user(); },
});

Template.settingsCharacter.events({
  'click .js-customize-menu'(event) {
    Session.set('settings-character-category', event.currentTarget.dataset.category);
  },
  'click .js-new-part'(event) {
    const { id } = event.currentTarget.dataset;
    if (id === 'null') {
      Meteor.users.update(Meteor.userId(), { $unset: { [`profile.${Session.get('settings-character-category')}`]: 1 } });
    } else {
      const part = Characters.findOne({ _id: id });
      if (part) Meteor.users.update(Meteor.userId(), { $set: { [`profile.${Session.get('settings-character-category')}`]: id } });
    }
  },
});
