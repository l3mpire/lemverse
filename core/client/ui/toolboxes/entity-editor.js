const closeInterface = () => Session.set('selectedEntityId', undefined);
const selectedEntity = () => Entities.findOne(Session.get('selectedEntityId'));

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

Template.entityEditor.helpers({
  flipped() { return selectedEntity()?.gameObject.scale < 0; },
  entity() { return selectedEntity(); },
});
