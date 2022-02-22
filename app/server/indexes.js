Meteor.startup(() => {
  Entities.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Messages.createIndex({ channel: 1 }, { name: 'channel_1' });

  Meteor.users.createIndex({ 'profile.levelId': 1, 'status.online': 1 }, { name: 'levelId_1_status_1' });

  Notifications.createIndex({ userId: 1 }, { name: 'userId_1' });

  Tiles.createIndex({ levelId: 1 }, { name: 'levelId_1' });

  Zones.createIndex({ levelId: 1 }, { name: 'levelId_1' });
});
