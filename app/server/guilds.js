// For the moment we return all the guilds, later we will have to publish only those useful to the user
Meteor.publish('guilds', function () {
  if (!this.userId) return undefined;
  return Guilds.find();
});
