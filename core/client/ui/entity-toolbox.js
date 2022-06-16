const filesRoute = Meteor.settings.public.files.route;
const thumbnailMaxSize = 35;
const closeInterface = () => Session.set('selectedEntityId', undefined);
const prefabEntities = () => Entities.find({ prefab: true }).fetch();
const selectedEntity = () => Entities.findOne(Session.get('selectedEntityId'));
const customEntityUploadAllowed = () => lp.isLemverseBeta('custom-sprite');

Template.entityToolbox.onRendered(function () {
  this.subscribe('entityPrefabs', Meteor.user().profile.levelId);
});

Template.entityToolbox.helpers({
  entities() { return prefabEntities(); },
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
});

Template.entityToolboxEntry.helpers({
  name() { return this.name || 'Entity'; },
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

Template.entityToolboxEntry.events({
  'click .js-entity-entry'() { Meteor.call('spawnEntityFromPrefab', this._id); },
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
