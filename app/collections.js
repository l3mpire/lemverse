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
    const { meta, mime, size } = file;

    if (size > 5000000) return `File too big (> 5MB)`;

    if (meta.source === 'editor-tilesets') {
      if (!['image/png', 'image/jpeg'].includes(mime)) return `Only jpeg and png can be uploaded`;
      return true;
    }

    if (meta.source === 'editor-characters') {
      if (!['image/png', 'image/jpeg'].includes(mime)) return `Only jpeg and png can be uploaded`;
      return true;
    }

    if (meta.source === 'voice-recorder') {
      if (!['audio/webm', 'audio/ogg', 'audio/mp4'].includes(mime)) return `Only webm, ogg and mp4 can be uploaded`;
      if (!meta.userIds.length) return `userIds are required to send an audio file`;

      return true;
    }

    return 'Source of upload not set';
  },
});
