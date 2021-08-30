const getImage = id => {
  const character = Characters.findOne(id);
  return character;
};

Template.settingsCharacter.onCreated(() => {
  if (!Session.get('settings-character-category')) Session.set('settings-character-category', 'body');
});

Template.settingsCharacter.helpers({
  getAppearance() {
    return Object.keys(charactersParts).filter(part => Meteor.user()?.profile[part]).map(part => getImage(Meteor.user()?.profile[part]));
  },
  getAllImages() {
    return Characters.find({ category: Session.get('settings-character-category'), $or: [{ hide: { $exists: false } }, { hide: false }] }).fetch();
  },
  isBodyPart(id) {
    return Meteor.user().profile[Session.get('settings-character-category')] === id;
  },
});

Template.settingsCharacter.events({
  'click .js-back'() {
    Session.set('settingsMode', 'default');
  },
  'click .js-customize-menu'(e) {
    Session.set('settings-character-category', e.currentTarget.dataset.category);
  },
  'click .js-new-part'(e) {
    const { id } = e.currentTarget.dataset;
    if (id === 'null') {
      Meteor.users.update(Meteor.userId(), { $unset: { [`profile.${Session.get('settings-character-category')}`]: 1 } });
    } else {
      const part = Characters.findOne({ _id: id });
      if (part) Meteor.users.update(Meteor.userId(), { $set: { [`profile.${Session.get('settings-character-category')}`]: e.currentTarget.dataset.id } });
    }
  },
});
