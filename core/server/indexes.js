Meteor.startup(() => {
  Entities.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Meteor.users.createIndex({ 'profile.levelId': 1 }, { name: 'levelId_1_status_1', partialFilterExpression: { 'status.online': true } });

  Tiles.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Zones.createIndex({ levelId: 1 }, { name: 'levelId_1' });
});
