zoom = 1.5;
selectedCharactersPart = () => Characters.findOne(Session.get('selectedCharacterId')) || {};
findFirstCharacters = () => {
  const filter = {};
  if (Session.get('editorCharactersFilter')) {
    filter.category = Session.get('editorCharactersFilter');
  } else {
    filter.category = { $exists: false };
  }
  return Characters.findOne(filter);
};

Template.editorCharacters.onCreated(function () {
  this.subscribe('characters');
});

Template.editorCharacters.helpers({
  hasCharactersFiles() {
    return Characters.find({}).fetch();
  },
  charactersList() {
    const filter = {};
    if (Session.get('editorCharactersFilter')) {
      filter.category = Session.get('editorCharactersFilter');
    } else {
      filter.category = { $exists: false };
    }
    return Characters.find(filter).fetch();
  },
  getCurrentFilter() {
    return Session.get('editorCharactersFilter') || 'none';
  },
});

Template.registerHelper('selectedCharactersPart', () => selectedCharactersPart());

Template.editorCharacters.events({
  'change .js-characters-list'(e) {
    Session.set('selectedCharacterId', e.currentTarget?.value || null);
  },
  'click .js-set-category'(e) {
    const { category } = e.currentTarget.dataset;
    const currentId = selectedCharactersPart()._id;

    Meteor.call('updateUsersCharacter', Session.get('editorCharactersFilter'), category, currentId, err => {
      if (!err) {
        Session.set('selectedCharacterId', findFirstCharacters()?._id || null);
      } else {
        lp.notif.error(`Error while changing category, ${err.reason}`);
      }
    });
  },
  'click .js-change-filter'(e) {
    const { category } = e.currentTarget.dataset;
    Session.set('editorCharactersFilter', category === 'none' ? null : category);
    Session.set('selectedCharacterId', findFirstCharacters()?._id || null);
  },
  'dragover .js-drop-zone, dragenter .js-drop-zone'({ currentTarget }) {
    currentTarget.classList.add('is-over');
  },

  'drag .js-drop-zone, dragstart .js-drop-zone, dragend .js-drop-zone, dragover .js-drop-zone, dragenter .js-drop-zone, dragleave .js-drop-zone, drop .js-drop-zone'(e) {
    e.preventDefault();
    e.stopPropagation();
  },

  'dragleave .js-drop-zone, dragend .js-drop-zone, drop .js-drop-zone'({ currentTarget }) {
    currentTarget.classList.remove('is-over');
  },

  'drop .js-drop-zone'({ currentTarget, originalEvent }) {
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
        if (error) {
          lp.notif.error(`Error during upload: ${error.reason}`);
        }
        if (Characters.find({}).count() === 0) {
          currentTarget.classList.add('is-over');
        }
      });

      uploadInstance.start();
    });
  },
});
