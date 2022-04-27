const prefabEntities = () => Entities.find({ prefab: true }).fetch();

Template.entityToolbox.onRendered(function () {
  this.subscribe('entityPrefabs');
});

Template.entityToolbox.helpers({
  entities() { return prefabEntities(); },
  showEntityList() { return !Session.get('selectedEntity'); },
});

Template.entityToolboxEntry.helpers({
  name() { return this.name || 'Entity'; },
  thumbnail() {
    if (this.thumbnail) return this.thumbnail;

    return this.gameObject?.sprite?.path;
  },
});

Template.entityToolboxEntry.events({
  'click .js-entity-entry'() { Meteor.call('spawnEntityFromPrefab', this._id); },
});

Template.entityEditor.helpers({
  entity() { return Entities.findOne(Session.get('selectedEntity')); },
});

Template.entityEditor.events({
  'click .js-entity-delete'() {
    lp.notif.confirm('Entity deletion', `Are you sure to delete this entity?`, () => {
      Entities.remove(Session.get('selectedEntity'));
      Session.set('selectedEntity', undefined);
    }, null);
  },
});
