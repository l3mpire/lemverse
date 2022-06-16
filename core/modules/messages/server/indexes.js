Meteor.startup(() => {
  Messages.createIndex({ channel: 1 }, { name: 'channel_1' });
});
