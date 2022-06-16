zoom = 1.5;
selectedCharactersPart = () => Characters.findOne(Session.get('selectedCharacterId')) || {};
findFirstCharacters = () => {
  const filter = { category: Session.get('editorCharactersFilter') || { $exists: false } };
  return Characters.findOne(filter);
};

Template.editorCharacters.onCreated(function () {
  this.subscribe('characters');

  Session.set('showDropZone', false);
  Tracker.autorun(() => {
    Session.set('showDropZone', !Characters.find({}).count());
  });
});

Template.editorCharacters.helpers({
  hasCharactersFiles() {
    return Characters.find({}).fetch();
  },
  charactersList() {
    const filter = { category: Session.get('editorCharactersFilter') || { $exists: false } };
    return Characters.find(filter).fetch();
  },
  getCurrentFilter() {
    return Session.get('editorCharactersFilter') || 'none';
  },
});

Template.registerHelper('selectedCharactersPart', () => selectedCharactersPart());

Template.editorCharacters.events({
  'change .js-characters-list'(event) {
    Session.set('selectedCharacterId', event.currentTarget?.value || null);
  },
  'click .js-set-category'(event) {
    const { category } = event.currentTarget.dataset;
    const currentId = selectedCharactersPart()._id;

    Meteor.call('updateUsersCharacter', Session.get('editorCharactersFilter'), category, currentId, err => {
      if (err) {
        lp.notif.error(`Error while changing category, ${err.reason}`);
        return;
      }

      Session.set('selectedCharacterId', findFirstCharacters()?._id || null);
    });
  },
  'click .js-change-filter'(event) {
    const { category } = event.currentTarget.dataset;
    Session.set('editorCharactersFilter', category === 'none' ? null : category);
    Session.set('selectedCharacterId', findFirstCharacters()?._id || null);
  },
  'dragover .js-drop-zone, dragenter .js-drop-zone'() {
    Session.set('showDropZone', true);
  },

  'drag .js-drop-zone, dragstart .js-drop-zone, dragend .js-drop-zone, dragover .js-drop-zone, dragenter .js-drop-zone, dragleave .js-drop-zone, drop .js-drop-zone'(event) {
    event.preventDefault();
    event.stopPropagation();
  },

  'dragleave .js-drop-zone, dragend .js-drop-zone, drop .js-drop-zone'() {
    Session.set('showDropZone', false);
  },

  'drop .js-drop-zone'({ originalEvent }) {
    const uploadedFiles = originalEvent.dataTransfer.files;
    Array.from(uploadedFiles).forEach(file => {
      if (!file) return;

      const uploadInstance = Files.insert({
        file,
        chunkSize: 'dynamic',
        meta: {
          source: 'editor-characters',
        },
      }, false);

      uploadInstance.on('end', error => {
        if (error) lp.notif.error(`Error during upload: ${error.reason}`);
        if (Characters.find({}).count() === 0) Session.set('showDropZone', false);
      });

      uploadInstance.start();
    });
  },
});
