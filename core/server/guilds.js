import { EventEmitter } from 'node:events';
import { canEditGuild } from '../lib/misc';

/**
 * Guild event emitter
 * @type {EventEmitter}
 */
const guildEvents = new EventEmitter();

const guilds = guildIds => {
  check(guildIds, [Match.Id]);
  return Guilds.find({ _id: { $in: guildIds } });
};

/**
 * Create a new guild and emit event new_guild
 * @fires new_guild
 * @param {tNewGuildParams} params - External guild parameters
 *
 * @returns {string} The guild ID
 */
const createGuild = params => {
  /** @type {string} */
  const guildId = Guilds.id();
  Guilds.insert({
    _id: guildId,
    createAt: new Date(),
    name: params.name,
    owners: params.owners,
    createdBy: params.createdBy,
  });

  /**
   * New guild event.
   * @event new_guild
   * @type {object}
   * @property {string} guildId - The new guild ID
   * @property {string} name - The new guild name
   * @property {string} email - The new guild owner email
   */
  guildEvents.emit('new_guild', {
    id: guildId,
    name: params.name,
    email: params.email,
  });

  return guildId;
};


/**
 * Create a new guild and emit event new_guild
 * @fires member_changed
 * @param {string} _guildId - The modified guild ID
 *
 * @returns {void}
 */
const _emitTeamMemberEvent = _guildId => {
  const guildMembersCount = Meteor.users.find({ guildId: _guildId }).count();
  /**
   * Number of guild member change event.
   * @event member_changed
   * @type {object}
   * @property {string} guildId - The new guild ID
   * @property {number} count - Number of guild member
   */
  guildEvents.emit('member_changed', {
    id: _guildId,
    count: guildMembersCount,
  });
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

    _emitTeamMemberEvent(guildId);
    log('addGuildUsers: done');
  },
  removeTeamUsers(guildId, userIds) {
    check(guildId, Match.Id);
    check(userIds, [Match.Id]);
    log('removeTeamUsers: start', { guildId, userIds });

    if (!userIds.length) return;
    if (!this.userId) throw new Meteor.Error('not-authorized', 'User not allowed');

    const guild = Guilds.findOne(guildId);
    if (!canEditGuild(Meteor.user(), guild)) throw new Meteor.Error('not-authorized', `Missing permissions to edit team members`);

    let users = Meteor.users.find({ _id: { $in: userIds }, guildId });
    if (users.length !== userIds.length) throw new Meteor.Error('user-invalid', 'Given user is not in the team');

    Meteor.users.update({ _id: { $in: userIds } }, { $unset: { guildId: 1 } });

    // analytics
    users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
    users.forEach(currentUser => {
      analytics.identify(currentUser);
      analytics.track(this.userId, '👨‍👨‍👦 Guild Remove User', { user_id: currentUser._id, guild_id: guildId });
    });
    analytics.updateGuild(Guilds.findOne(guildId), {}, Meteor.userId());

    _emitTeamMemberEvent(guildId);
    log('removeTeamUsers: done');
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
  teamUserCount(guildId) {
    if (!this.userId) return 0;
    check(guildId, Match.Id);

    return Meteor.users.find({ guildId }).count();
  },
});


export {
  createGuild,

  guildEvents,
};

/**
 * @typedef {object} tNewGuildParams
 * @property {string} name - The guild name
 * @property {string[]} owners - Array of owners ID
 * @property {string} createdBy - The creator
 * @property {string} email - The creator email
 */
