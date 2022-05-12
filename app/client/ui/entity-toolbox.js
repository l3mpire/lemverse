const filesRoute = Meteor.settings.public.files.route;
const thumbnailMaxSize = 35;
const closeInterface = () => Session.set('selectedEntityId', undefined);
const prefabEntities = () => Entities.find({ prefab: true }).fetch();

Template.entityToolbox.onRendered(function () {
  this.subscribe('entityPrefabs');
});

Template.entityToolbox.helpers({
  entities() { return prefabEntities(); },
  showEntityList() { return !Session.get('selectedEntityId'); },
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
  entity() { return Entities.findOne(Session.get('selectedEntityId')); },
});

Template.entityEditor.events({
  'click .js-entity-delete'() {
    lp.notif.confirm('Entity deletion', `Are you sure to delete this entity?`, () => {
      Entities.remove(Session.get('selectedEntityId'));
      closeInterface();
    }, null);
  },
  'click .js-close-entity-editor'() { closeInterface(); },
});
