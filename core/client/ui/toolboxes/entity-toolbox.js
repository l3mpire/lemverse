const closeInterface = () => Session.set('selectedEntityId', undefined);
const selectedEntity = () => Entities.findOne(Session.get('selectedEntityId'));
const customEntityUploadAllowed = () => lp.isLemverseBeta('custom-sprite');

Template.entityToolbox.helpers({
  showEntityList() { return !Session.get('selectedEntityId'); },
  customEntityUploadAllowed() { return customEntityUploadAllowed(); },
});

Template.entityToolbox.events({
  'change .js-entity-sprite-upload'(event) {
    if (!customEntityUploadAllowed()) return;
    const file = event.currentTarget.files[0];

    const uploadedFile = Files.insert({ file, meta: { source: 'toolbox-entity', userId: Meteor.userId() } }, false);
    uploadedFile.on('end', (error, fileDocument) => {
      if (error) { lp.notif.error(`Error during file upload: ${error.reason}`); return; }
      Meteor.call('spawnEntityFromFile', fileDocument._id);
    });

    uploadedFile.start();
  },
  'click .js-open-entity-template-list'() { Session.set('modal', { template: 'entityTemplateList' }); },
});

Template.entityEditor.helpers({
  flipped() { return selectedEntity()?.gameObject.scale < 0; },
  entity() { return selectedEntity(); },
});

Template.entityEditor.events({
  'click .js-entity-delete'() {
    lp.notif.confirm('Entity deletion', `Are you sure to delete this entity?`, () => {
      Entities.remove(Session.get('selectedEntityId'));
      closeInterface();
    });
  },
  'input #entity-depth'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    const { valueAsNumber: value } = event.target;
    Entities.update(entity._id, { $set: { 'gameObject.depth': value } });
  },
  'input #entity-scale'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    const { valueAsNumber: value } = event.target;
    if (value !== 0) Entities.update(entity._id, { $set: { 'gameObject.scale': value } });
  },
  'click .js-close-entity-editor'() { closeInterface(); },
});
