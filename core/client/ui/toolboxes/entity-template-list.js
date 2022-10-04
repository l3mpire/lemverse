import { generateEntityThumbnail } from '../../helpers';

const prefabHideProperties = [
  '_id',
  'levelId',
  'createdAt',
  'createdBy',
];

const prefabEntities = () => Entities.find({ prefab: true }).fetch();
const getAllInstances = (key) => Entities.find({ 'gameObject.sprite.key': key }).fetch();

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

Template.entityEditPrefab.helpers({
  properties() {
    const props = _.clone(this.entity);
    prefabHideProperties.forEach(property => { delete props[property]; });

    return JSON.stringify(props, ' ', 2);
  },
  name() { return this.entity.name || this.entity._id; },
});

Template.entityTemplateList.events({
  'click .js-entity-entry'() {
    Meteor.call('spawnEntityFromPrefab', this._id, error => {
      if (error) { lp.notif.error('Unable to spawn the entity for now, please try later'); return; }
      closeModal();
    });
  },
  'click .js-entity-edit'() {
    Session.set('modal', { template: 'entityEditPrefab', entity: this });
  },
});

Template.entityEditPrefab.events({
  'click .js-prefab-delete'() {
    lp.notif.confirm('Entity prefab deletion', `Are you sure to delete the prefab "<b>${this.entity.name || this.entity._id}</b>"?`, () => {
      Entities.remove(this.entity._id);
      closeModal();
    });
  },
  'click .js-prefab-delete-all'() {
    if (!this.entity.gameObject?.sprite?.key) return;

    const instances = getAllInstances(this.entity.gameObject.sprite.key);
    lp.notif.confirm('Entity instances deletion', `Are you sure to delete ${instances.length} instance(s) of "<b>${this.entity.name || this.entity._id}</b>"?`, () => {
      instances.forEach(instance => Entities.remove(instance._id));
      closeModal();
    });
  },
  'click .js-prefab-cancel'() { closeModal(); },
  'click .js-prefab-save'() {
    const currentFields = this.entity;
    let newValues;
    try {
      newValues = JSON.parse($('.entity-toolbox-properties textarea').val());
    } catch (err) { lp.notif.error(`invalid JSON format`, err); }

    const $unset = _.reduce(currentFields, (root, k, i) => {
      const newObject = { ...root };
      if (!prefabHideProperties.includes(i) && !Object.keys(newValues).includes(i)) newObject[i] = 1;
      return newObject;
    }, {});
    if (_.isEmpty($unset)) Entities.update(this.entity._id, { $set: newValues });
    else Entities.update(this.entity._id, { $set: newValues, $unset });

    lp.notif.success('Entity prefab updated');

    Session.set('modal', { template: 'entityTemplateList' });
  },
});
