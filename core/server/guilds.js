import { canEditGuild } from '../lib/misc';

const guilds = guildIds => {
  check(guildIds, [Match.Id]);
  return Guilds.find({ _id: { $in: guildIds } });
};

Meteor.publish('guilds', function (guildIds) {
  if (!this.userId) return undefined;
  check(guildIds, [Match.Id]);

  return guilds(guildIds);
});

Meteor.methods({
  addGuildUsers(guildId, userIds) {
    check(guildId, Match.Id);
    check(userIds, [Match.Id]);
    log('addGuildUsers: start', { guildId, userIds });

    if (!userIds.length) return;
    if (!this.userId) throw new Meteor.Error('not-authorized', 'User not allowed');

    const guild = Guilds.findOne(guildId);
    if (!canEditGuild(Meteor.user(), guild)) throw new Meteor.Error('not-authorized', `Missing permissions to edit team members`);

    const userCount = Meteor.users.find({ _id: { $in: userIds }, guildId: { $exists: true } }).count();
    if (userCount) throw new Meteor.Error('users-invalid', 'Some users are already in a Guild');

    Meteor.users.update({ _id: { $in: userIds } }, { $set: { guildId } }, { multi: true });

    // analytics
    const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
    users.forEach(user => {
      analytics.identify(user);
      analytics.track(this.userId, '👨‍👨‍👦 Guild Add User', { user_id: user._id, guild_id: guildId });
    });
    analytics.updateGuild(Guilds.findOne(guildId), {}, Meteor.userId());

    log('addGuildUsers: done');
  },
  removeTeamUser(guildId, userId) {
    check([guildId, userId], [Match.Id]);
    log('removeTeamUser: start', { guildId, userId });

    if (!this.userId) throw new Meteor.Error('not-authorized', 'User not allowed');

    if (!canEditGuild(Meteor.user(), Guilds.findOne(guildId))) throw new Meteor.Error('not-authorized', `Missing permissions to edit team members`);

    const user = Meteor.users.findOne(userId);
    if (user.guildId !== guildId) throw new Meteor.Error('user-invalid', 'Given user is not in the team');

    Meteor.users.update(userId, { $unset: { guildId: 1 } });

    // analytics
    analytics.identify(Meteor.users.findOne(userId));
    analytics.track(this.userId, '👨‍👨‍👦 Guild Remove User', { user_id: userId, guild_id: guildId });
    analytics.updateGuild(Guilds.findOne(guildId), {}, userId);

    log('removeTeamUser: done');
  },
  guilds(guildIds) {
    if (!this.userId) throw new Meteor.Error('not-authorized', 'User not allowed');
    check(guildIds, [Match.Id]);

    return guilds(guildIds).fetch();
  },
  updateTeam(fields) {
    if (!this.userId) return;

    check(fields, {
      description: Match.Optional(String),
      name: Match.Optional(String),
      website: Match.Optional(String),
    });

    const fieldsToUnsetKeys = Object.entries(fields).filter(field => !field[1]).map(field => field[0]);
    const fieldsToSet = fields;

    const fieldsToUnset = {};
    fieldsToUnsetKeys.forEach(key => { fieldsToUnset[key] = 1; });

    const user = Meteor.users.findOne(this.userId);
    const { guildId } = user;

    const guild = Guilds.findOne(guildId);
    if (!canEditGuild(Meteor.user(), guild)) throw new Meteor.Error('not-authorized', `Missing permissions to edit the team`);

    Guilds.update(guildId, {
      $set: { ...fieldsToSet },
      $unset: { ...fieldsToUnset },
    });

    analytics.updateGuild(Guilds.findOne(guildId), {}, this.userId);
  },
});
