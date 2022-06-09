// For the moment we return all the guilds, later we will have to publish only those useful to the user
Meteor.publish('guilds', function () {
  if (!this.userId) return undefined;
  return Guilds.find();
});

Meteor.methods({
  addGuildUsers(guildId, userIds) {
    check(guildId, String);
    check(userIds, [String]);
    if (!userIds.length) return;
    if (!this.userId) throw new Meteor.Error('not-authorized', 'User not allowed');

    if (!canEditGuild(this.userId, guildId)) throw new Meteor.Error('not-authorized', 'User not allowed');

    const userCount = Meteor.users.find({ _id: userIds, guildId: { $exists: true } }).count();
    if (userCount) throw new Meteor.Error('users-invalid', 'Some users are already in a Guild');

    Meteor.users.update({ _id: { $in: userIds } }, { $set: { guildId } }, { multi: true });
  },
});
