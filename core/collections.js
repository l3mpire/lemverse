import { canEditActiveLevel } from './lib/misc';
import fileSystemAdapter from './lib/file-storage';

const canEditLevelContent = userId => canEditActiveLevel(Meteor.users.findOne(userId));

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
  insert(userId) { return canEditLevelContent(userId); },
  update(userId) { return canEditLevelContent(userId); },
  remove(userId) { return canEditLevelContent(userId); },
});

Zones = lp.collectionRegister('zones', 'zon', [], {
  insert(userId) { return canEditLevelContent(userId); },
  update(userId) { return canEditLevelContent(userId); },
  remove(userId) { return canEditLevelContent(userId); },
});

Levels = lp.collectionRegister('levels', 'lvl', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return canEditLevelContent(userId); },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Entities = lp.collectionRegister('entities', 'ent', [], {
  insert(userId) { return canEditLevelContent(userId); },
  update(userId) { return canEditLevelContent(userId); },
  remove(userId) { return canEditLevelContent(userId); },
});

Guilds = lp.collectionRegister('guilds', 'gui', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});

Files = fileSystemAdapter();
