import Phaser from 'phaser';

const customEntityUploadAllowed = () => lp.isLemverseBeta('custom-sprite');
const fetchEntities = () => Entities.find({ actionType: { $ne: entityActionType.pickable }, prefab: { $exists: false } }).fetch();

const entityInteractionConfiguration = {
  hitArea: new Phaser.Geom.Circle(15, 15, 50),
  hitAreaCallback: Phaser.Geom.Circle.Contains,
  cursor: 'pointer',
  draggable: true,
};

const onDrag = function (_pointer, dragX, dragY) {
  this.x = dragX;
  this.y = dragY;

  const linkedEntity = this.getData('linkedSprite');
  if (linkedEntity) linkedEntity.setPosition(dragX, dragY);

  this.setDepth(this.y);
};

const onDragEnd = function () { Entities.update(this.getData('id'), { $set: { x: this.x, y: this.y } }); };
const onPointerDown = function () { Session.set('selectedEntityId', this.getData('id')); };

Template.entityToolbox.onCreated(() => {
  const editorScene = game.scene.keys.EditorScene;
  this.entitiesEditAnchors = editorScene.add.container(0, 0);

  fetchEntities().forEach(entity => {
    const anchor = editorScene.add.sprite(entity.x, entity.y, 'circle')
      .setData('id', entity._id)
      .setData('actionType', entity.actionType)
      .setData('linkedSprite', entityManager.entities[entity._id])
      .setScale(0.2)
      .setDepth(10000)
      .setTint(0x02a3ff)
      .setInteractive(entityInteractionConfiguration)
      .on('pointerdown', onPointerDown)
      .on('drag', onDrag)
      .on('dragend', onDragEnd);

    this.entitiesEditAnchors.add(anchor);
  });
});

Template.entityToolbox.helpers({
  showEntityList() { return !Session.get('selectedEntityId'); },
  customEntityUploadAllowed() { return customEntityUploadAllowed(); },
  entities() { return fetchEntities(); },
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
  'click .js-open-entity-template-list'() { Session.set('modal', { template: 'entityTemplateList' }); },
  'click .js-open-entity-editor'() { Session.set('selectedEntityId', this._id); },
});

