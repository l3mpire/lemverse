import { generateEntityThumbnail } from '../helpers';

const thumbnailMaxSize = 20;

Template.editorEntity.helpers({
  label() { return this.label || this.name; },
  thumbnail() { return generateEntityThumbnail(this, thumbnailMaxSize); },
});

Template.editorEntity.events({
  'click .validated'(event, templateInstance) {
    const { checked } = event.currentTarget;
    Entities.update(templateInstance.data._id, { [checked ? '$set' : '$unset']: { validated: true } });
  },
  'blur .entity-label'(event, templateInstance) {
    const { value } = event.currentTarget;
    Entities.update(templateInstance.data._id, { $set: { label: value } });
  },
});

Template.editorEntities.onCreated(function () {
  this.subscribe('entityPrefabs');
});

Template.editorEntities.helpers({
  entities() { return Entities.find().fetch(); },
});

Template.editorEntities.events({ });
