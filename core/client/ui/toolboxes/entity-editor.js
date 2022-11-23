import { clamp, toggleUIInputs } from '../../helpers';

const entityMaxScale = 3;
const entityDepthRange = { min: -1, max: 9 };
const layerOffset = 10000 - 6; // 6 default value is equal to 10000, all layers > 5 are offset by 10000 - 5

const closeInterface = () => Session.set('selectedEntityId', undefined);
const selectedEntity = () => Entities.findOne(Session.get('selectedEntityId'));
const linkedEntity = () => Entities.findOne({ _id: selectedEntity()?.entityId });
const targets = () => {
  const activeEntityId = Session.get('selectedEntityId');
  return Entities.find({ _id: { $ne: activeEntityId }, actionType: { $ne: entityActionType.pickable } }).fetch();
};

Template.entityEditor.events({
  'click .back_btn'() {
    closeInterface();
  },
  'click .switch_anim'() {
    const entity = selectedEntity();
    Meteor.call('useEntity', entity.entityId ? entity.entityId : entity._id);
  },
  'click .js-entity-delete'() {
    lp.notif.confirm('Entity deletion', `Are you sure to delete this entity?`, () => {
      Entities.remove(Session.get('selectedEntityId'));
      closeInterface();
    });
  },
  'input #js-entity-action'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    const { value } = event.target;
    Entities.update(entity._id, { $set: { action: value } });
  },
  'input #entity-depth'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    var { valueAsNumber: value } = event.target;
    if (value >= 6) value += layerOffset;

    Entities.update(entity._id, { $set: { 'gameObject.depth': clamp(value, entityDepthRange.min, entityDepthRange.max + layerOffset) } });
  },
  'input #entity-scale'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    const { valueAsNumber: value } = event.target;
    if (value !== 0) Entities.update(entity._id, { $set: { 'gameObject.scale': clamp(value, -entityMaxScale, entityMaxScale) } });
  },
  'click .js-reset-attribute'(event) {
    const entity = selectedEntity();
    if (!entity) return;

    const param = {};
    param[`gameObject.${event.target.dataset.type}`] = 1;

    Entities.update(entity._id, { $unset: param });
  },
  'change #js-entity-target'(event) {
    Meteor.call('updateEntityTarget', Session.get('selectedEntityId'), event.target.value);
  },
  'blur .js-edit-entity-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleUIInputs(false);

    Entities.update(Session.get('selectedEntityId'), { $set: { name: event.currentTarget.value } });
  },
  'focus .js-edit-entity-name'(event) {
    event.preventDefault();
    event.stopPropagation();

    toggleUIInputs(true);
  },
});

Template.entityEditor.helpers({
  entity() { return selectedEntity(); },
  flipped() { return selectedEntity()?.gameObject.scale < 0; },
  state() { return linkedEntity()?.state || selectedEntity()?.state; },
  targets() { return targets(); },
  hasSprite() { return Boolean(selectedEntity()?.gameObject?.sprite); },
  isActionable() { return Boolean(selectedEntity()?.actionType === entityActionType.actionable); },
  hasCustomAction() { return Boolean(selectedEntity()?.action); },
});
