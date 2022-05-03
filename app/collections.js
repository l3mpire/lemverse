// Meteor Collections

Tilesets = lp.collectionRegister('tilesets', 'tis', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Characters = lp.collectionRegister('characters', 'chr', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Tiles = lp.collectionRegister('tiles', 'til', [], {
  insert(userId) { return isEditionAllowed(userId); },
  update(userId) { return isEditionAllowed(userId); },
  remove(userId) { return isEditionAllowed(userId); },
});

Zones = lp.collectionRegister('zones', 'zon', [], {
  insert(userId) { return isEditionAllowed(userId); },
  update(userId) { return isEditionAllowed(userId); },
  remove(userId) { return isEditionAllowed(userId); },
});

Levels = lp.collectionRegister('levels', 'lvl', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return isEditionAllowed(userId); },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Notifications = lp.collectionRegister('notifications', 'not', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId, notification) { return notification.userId === userId; },
  remove(userId, notification) { return notification.userId === userId; },
});

Entities = lp.collectionRegister('entities', 'ent', [], {
  insert(userId) { return isEditionAllowed(userId); },
  update(userId) { return isEditionAllowed(userId); },
  remove(userId) { return isEditionAllowed(userId); },
});

Guilds = lp.collectionRegister('guilds', 'gui', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Files = new FilesCollection({
  collectionName: 'Files',
  storagePath: '/var/tmp/lemverse',
  downloadRoute: '/api/files',
  public: true,
  allowClientCode: false,
  // debug: true,
  onBeforeUpload(file) {
    if (file.meta?.source === 'editor-tilesets') {
      if (file.size <= 5000000 && /png|jpe?g/i.test(file.extension)) return true;
      return 'Please upload an image (png, jpg or jpeg) less than 5MB';
    } else if (file.meta?.source === 'editor-characters') {
      if (file.size <= 5000000 && /png|jpe?g/i.test(file.extension)) return true;
      return 'Please upload an image (png, jpg or jpeg) less than 5MB';
    } else if (file.meta?.source === 'voice-recorder') {
      if (file.size <= 5000000 && /webm|ogg|mp4/i.test(file.extension)) return true;
      if (!file.meta.targets.length) return 'Targets required';

      return 'Please upload a valid sound file (webm, ogg or mp4) less than 5MB';
    } else if (file.meta?.source === 'user-console') {
      if (file.size <= 5000000 && /png|jpg|gif|jpeg/i.test(file.extension)) return true;
      return 'Please upload an image (png, jpg, gif or jpeg) less than 5MB';
    }

    return 'Source of upload not set. Can\'t continue.';
  },
});
