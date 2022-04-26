const prefabEntities = () => Entities.find({ prefab: true }).fetch();

Template.entityToolbox.onRendered(function () {
  this.subscribe('entityPrefabs');
});

Template.entityToolbox.helpers({
  entities() { return prefabEntities(); },
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
