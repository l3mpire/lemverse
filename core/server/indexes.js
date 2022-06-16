Meteor.startup(() => {
  Entities.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Meteor.users.createIndex({ 'profile.levelId': 1 }, { name: 'levelId_1_status_1', partialFilterExpression: { 'status.online': true } });

  Notifications.createIndex({ userId: 1 }, { name: 'userId_1' });

  Tiles.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Zones.createIndex({ levelId: 1 }, { name: 'levelId_1' });
});
