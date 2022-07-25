const customEntityUploadAllowed = () => lp.isLemverseBeta('custom-sprite');

Template.entityToolbox.helpers({
  showEntityList() { return !Session.get('selectedEntityId'); },
  customEntityUploadAllowed() { return customEntityUploadAllowed(); },
  entities() { return Entities.find({ actionType: { $ne: entityActionType.pickable } }).fetch(); },
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
  'click .js-open-entity-editor'() { Session.set('selectedEntityId', this._id); },
});

