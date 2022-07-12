Template.editorAssetListItem.helpers({
  lastUpdate() { return (this.updatedAt || this.createdAt).toLocaleString(); },
});

Template.editorAssets.onCreated(function () {
  this.subscribe('assets');

  Session.set('showDropZone', false);
  Tracker.autorun(() => Session.set('showDropZone', !Assets.find().count()));
});

Template.editorAssets.helpers({
  assets() { return Assets.find().fetch(); },
});

Template.editorAssets.events({
  'dragover .js-drop-zone, dragenter .js-drop-zone'() {
    Session.set('showDropZone', true);
  },

  'drag .js-drop-zone, dragstart .js-drop-zone, dragend .js-drop-zone, dragover .js-drop-zone, dragenter .js-drop-zone, dragleave .js-drop-zone, drop .js-drop-zone'(event) {
    event.preventDefault();
    event.stopPropagation();
  },

  'dragleave .js-drop-zone, dragend .js-drop-zone, drop .js-drop-zone'() {
    Session.set('showDropZone', false);
  },

  'drop .js-drop-zone'({ originalEvent }) {
    const uploadedFiles = originalEvent.dataTransfer.files;
    Array.from(uploadedFiles).forEach(file => {
      if (!file) return;

      const uploadInstance = Files.insert({
        file,
        chunkSize: 'dynamic',
        meta: {
          source: 'editor-assets',
          createdAt: new Date(),
        },
      }, false);

      uploadInstance.on('end', error => {
        if (error) lp.notif.error(`Error during upload: ${error.reason}`);
        if (Assets.find().count() === 0) Session.set('showDropZone', false);
      });

      uploadInstance.start();
    });
  },
});
