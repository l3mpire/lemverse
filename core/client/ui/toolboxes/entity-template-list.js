const thumbnailMaxSize = 35;
const prefabEntities = () => Entities.find({ prefab: true }).fetch();
const filesRoute = Meteor.settings.public.files.route;

Template.entityTemplateList.onRendered(function () {
  this.subscribe('entityPrefabs', Meteor.user().profile.levelId);
});

Template.entityTemplateList.helpers({
  entities() { return prefabEntities(); },
});

Template.entityTemplateEntry.helpers({
  name() { return this.name || 'Entity'; },
  thumbnail() {
    let url;
    if (!this.thumbnail) {
      url = this.gameObject?.sprite?.path;
      return `background-image: url("${url}"); background-size: contain; width: 100%; height: 100%;`;
    }

    const [x, y, w, h] = this.thumbnail.rect;
    url = `${filesRoute}/${this.thumbnail.fileId}`;

    const maxSize = Math.max(w, h);
    const ratio = thumbnailMaxSize / maxSize;

    return `background-image: url("./${url}"); background-position: -${x}px -${y}px; width: ${w}px; height: ${h}px; transform: scale(${ratio});`;
  },
});

Template.entityTemplateList.events({
  'click .js-entity-entry'() {
    Meteor.call('spawnEntityFromPrefab', this._id, error => {
      if (error) { lp.notif.error('Unable to spawn the entity for now, please try later'); return; }
      closeModal();
    });
  },
});
