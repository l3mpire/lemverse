Template.editorEntity.helpers({
  label() { return this.label || this.name; },
});

Template.editorEntity.events({
  'click .validated'(event, instance) {
    const { checked } = event.currentTarget;
    Entities.update(instance.data._id, { [checked ? '$set' : '$unset']: { validated: true } });
  },
});

Template.editorEntities.onCreated(function () {
  this.subscribe('entityPrefabs');
});

Template.editorEntities.helpers({
  entities() { return Entities.find().fetch(); },
});

Template.editorEntities.events({ });
