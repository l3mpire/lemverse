// Meteor Collections

Assets = lp.collectionRegister('assets', 'ast', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

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
  storagePath: Meteor.settings.public.files.storagePath,
  downloadRoute: Meteor.settings.public.files.route,
  public: true,
  allowClientCode: false,
  // debug: true,
  onBeforeUpload(file) { return fileOnBeforeUpload(file, file.mime); },
});
