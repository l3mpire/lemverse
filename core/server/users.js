import { completeUserProfile, levelSpawnPosition, teleportUserInLevel } from '../lib/misc';

const mainFields = { options: 1, profile: 1, roles: 1, status: { online: 1 }, beta: 1, guildId: 1 };

Meteor.publish('users', function (levelId) {
  check(levelId, Match.Maybe(Match.Id));
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  const { guildId } = Meteor.user();
  let filters = { 'status.online': true, 'profile.levelId': levelId };
  if (guildId) {
    filters = {
      $or: [
        { 'profile.levelId': levelId, 'status.online': true },
        { guildId },
      ],
    };
  }

  return Meteor.users.find(filters, { fields: mainFields });
});

Meteor.publish('selfUser', function () {
  if (!this.userId) return '';

  return Meteor.users.find(
    this.userId,
    { fields: { emails: 1, options: 1, profile: 1, roles: 1, status: 1, beta: 1, entitySubscriptionIds: 1, zoneLastSeenDates: 1, inventory: 1, zoneMuted: 1 } },
  );
});

Meteor.publish('usernames', function (userIds) {
  if (!this.userId) return undefined;
  check(userIds, [Match.Id]);

  return Meteor.users.find({ _id: { $in: userIds } }, { fields: mainFields });
});

Meteor.publish('userProfile', function (userId) {
  if (!this.userId) return undefined;
  check(userId, Match.Id);

  return Meteor.users.find(userId, { fields: { ...mainFields, createdAt: 1 } });
});

Meteor.methods({
  teleportToGuildLevel() {
    log('teleportToGuildLevel: start', { userId: this.userId });
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');

    const { guildId } = Meteor.user();
    if (!guildId) throw new Meteor.Error('missing-guild', 'You are not in a guild');

    const level = Levels.findOne({ guildId });
    if (!level) throw new Meteor.Error('missing-level', 'Level not found');

    log('teleportToGuildLevel: done', { userId: this.userId, guildId, levelId: level._id });

    return teleportUserInLevel(Meteor.user(), level, 'onboarding-button');
  },
  teleportToDefaultLevel() {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    return teleportUserInLevel(Meteor.user(), Levels.findOne(Meteor.settings.defaultLevelId), 'onboarding-button');
  },
  toggleEntitySubscription(entityId) {
    check(entityId, Match.Id);
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');

    const entitySubscriptionIds = Meteor.user().entitySubscriptionIds || [];
    if (entitySubscriptionIds.includes(entityId)) Meteor.users.update(this.userId, { $pull: { entitySubscriptionIds: entityId } });
    else Meteor.users.update(this.userId, { $push: { entitySubscriptionIds: entityId } });
  },
  convertGuestAccountToRealAccount(email, name, password, source = 'self') {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check([email, name, password], [String]);
    check(source, Match.OneOf('self', 'invite'));

    const user = Meteor.user();
    if (!user.profile.guest) throw new Meteor.Error('invalid-user', 'Guest account already converted to a normal account');

    completeUserProfile(user, email, name);
    Accounts.setPassword(this.userId, password, { logout: false });

    analytics.identify(Meteor.user());
    analytics.track(this.userId, '🐣 Sign Up', { source });
  },
  teleportUserInLevel(levelId) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(levelId, Match.Id);

    return teleportUserInLevel(Meteor.user(), Levels.findOne(levelId), 'teleporter');
  },
  markNotificationAsRead(notificationId) {
    if (!this.userId) return;
    check(notificationId, Match.Id);

    Notifications.update({ _id: notificationId, userId: this.userId }, { $set: { read: true } });
  },

  markAllNotificationsAsRead() {
    if (!this.userId) return;

    Notifications.update({ userId: this.userId }, { $set: { read: true } }, { multi: true });
  },

  kickUser(userId) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(userId, Match.Id);
    if (!Meteor.settings.defaultKickLevelId) throw new Meteor.Error('missing-levelId', 'Missing configuration for defaultKickLevelId');
    const level = Levels.findOne({ _id: Meteor.settings.defaultKickLevelId });
    if (!level) throw new Meteor.Error('missing-levelId', 'Level in defaultKickLevelId does not exists');
    log('kickUser', { kicker: Meteor.userId(), kicked: userId });

    Meteor.users.update({ _id: userId }, { $set: { 'profile.levelId': Meteor.settings.defaultKickLevelId } });
  },
  updateZoneLastSeenDate(zoneId, create = false) {
    if (!this.userId) return;
    check(zoneId, Match.Id);
    check(create, Boolean);

    const { zoneLastSeenDates } = Meteor.user();
    if (create || (zoneLastSeenDates && zoneLastSeenDates[zoneId])) Meteor.users.update(this.userId, { $set: { [`zoneLastSeenDates.${zoneId}`]: new Date() } });
  },
  unsubscribeFromZone(zoneId) {
    if (!this.userId) return;
    check(zoneId, Match.Id);

    Meteor.users.update(this.userId, { $unset: { [`zoneLastSeenDates.${zoneId}`]: 1 } });
  },
  muteFromZone(zoneId) {
    if (!this.userId) return;
    check(zoneId, Match.Id);

    Meteor.users.update(this.userId, { $set: { [`zoneMuted.${zoneId}`]: 1 } });
  },
  unmuteFromZone(zoneId) {
    if (!this.userId) return;
    check(zoneId, Match.Id);

    Meteor.users.update(this.userId, { $unset: { [`zoneMuted.${zoneId}`]: 1 } });
  },
  updateUserAccount(fields) {
    if (!this.userId) return;
    check(fields, {
      avatar: Match.Optional(String),
      bio: Match.Optional(String),
      defaultReaction: Match.Optional(String),
      name: Match.Optional(String),
      baseline: Match.Optional(String),
      nameColor: Match.Optional(String),
      website: Match.Optional(String),
    });

    const fieldsToUnsetKeys = Object.entries(fields).filter(field => !field[1]).map(field => field[0]);
    const fieldsToSetKeys = Object.entries(fields).filter(field => !fieldsToUnsetKeys.includes(field[0])).map(field => field[0]);

    const fieldsToSet = {};
    fieldsToSetKeys.forEach(key => { fieldsToSet[`profile.${key}`] = fields[key]; });

    const fieldsToUnset = {};
    fieldsToUnsetKeys.forEach(key => { fieldsToUnset[`profile.${key}`] = 1; });

    Meteor.users.update(this.userId, {
      $set: { ...fieldsToSet },
      $unset: { ...fieldsToUnset },
    });

    analytics.identify(Meteor.user());
  },
});

Meteor.users.find({ 'status.online': true }).observeChanges({
  added(id) {
    const user = Meteor.users.findOne(id);
    if (!user.status.lastLogoutAt) return;

    const { defaultLevelId, respawnDelay } = Meteor.settings;
    const { guildId } = user;
    const guild = Guilds.findOne(guildId);

    if (guild?.forceDefaultLevel) {
      lp.notif.warning('Your level is unavailable, your have been redirected to default level.');
      const spawnPosition = levelSpawnPosition(defaultLevelId);
      Meteor.users.update(user._id, { $set: { 'profile.x': spawnPosition.x, 'profile.y': spawnPosition.y } });
      return;
    }

    if (!respawnDelay) return;

    const diffInMinutes = (Date.now() - new Date(user.status.lastLogoutAt).getTime()) / 60000;
    if (diffInMinutes < respawnDelay) return;

    const levelId = user.profile.levelId || defaultLevelId;
    const currentLevel = Levels.findOne(levelId);


    const spawnPosition = levelSpawnPosition(currentLevel);
    Meteor.users.update(user._id, { $set: { 'profile.x': spawnPosition.x, 'profile.y': spawnPosition.y } });
  },
  removed(id) {
    const user = Meteor.users.findOne(id);
    if (!user) return; // guest users are removed on log-in or sign-in, the findOne can be undefined

    if (!user.profile?.guest) analytics.track(id, '🚪 Log Out', { guild_id: user.guildId });

    Meteor.users.update(id, { $set: { 'status.lastLogoutAt': new Date() } });
  },
});
