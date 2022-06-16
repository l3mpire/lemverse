Meteor.startup(() => {
  Notifications.createIndex({ userId: 1 }, { name: 'userId_1' });
});
