const filesRoute = Meteor.settings.public.files.route;
const thumbnailMaxSize = 20;

Template.editorEntity.helpers({
  label() { return this.label || this.name; },
  thumbnail() {
    if (!this.thumbnail) {
      const url = this.gameObject?.sprite?.path;
      return `background-image: url("${url}"); background-size: contain; width: 100%; height: 100%;`;
    }

    const [x, y, w, h] = this.thumbnail.rect;
    const url = `${filesRoute}/${this.thumbnail.fileId}`;

    const maxSize = Math.max(w, h);
    const ratio = thumbnailMaxSize / maxSize;

    return `background-image: url("./${url}"); background-position: -${x}px -${y}px; width: ${w}px; height: ${h}px; transform: scale(${ratio});`;
  },
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
