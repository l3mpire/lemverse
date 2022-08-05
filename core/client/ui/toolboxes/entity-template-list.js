import { generateEntityThumbnail } from '../../helpers';

const prefabEntities = () => Entities.find({ prefab: true }).fetch();

Template.entityTemplateList.onRendered(function () {
  this.subscribe('entityPrefabs', Meteor.user().profile.levelId);
});

Template.entityTemplateList.helpers({
  entities() { return prefabEntities(); },
});

Template.entityTemplateEntry.helpers({
  name() { return this.name || 'Entity'; },
  thumbnail() { return generateEntityThumbnail(this); },
});

Template.entityTemplateList.events({
  'click .js-entity-entry'() {
    Meteor.call('spawnEntityFromPrefab', this._id, error => {
      if (error) { lp.notif.error('Unable to spawn the entity for now, please try later'); return; }
      closeModal();
    });
  },
});
