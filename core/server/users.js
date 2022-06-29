const mainFields = { options: 1, profile: 1, roles: 1, status: { online: 1 }, beta: 1, guildId: 1 };

isolateUser = userId => {
  check(userId, Match.Id);
  if (!isEditionAllowed(Meteor.userId())) throw new Meteor.Error('missing-permissions', `You don't have the permissions`);

  const { levelId } = Meteor.user().profile;
  const { isolationPosition } = Levels.findOne(levelId);
  if (!isolationPosition) throw new Meteor.Error('missing-isolation-position', 'isolationPosition not set on the level');
  Meteor.users.update(userId, { $set: { 'profile.x': +isolationPosition.x, 'profile.y': +isolationPosition.y } });
};

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

    return teleportUserInLevel(level._id, this.userId, 'onboarding-button');
  },
  teleportToDefaultLevel() {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    return teleportUserInLevel(Meteor.settings.defaultLevelId, this.userId, 'onboarding-button');
  },
  toggleEntitySubscription(entityId) {
    check(entityId, Match.Id);
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');

    const entitySubscriptionIds = Meteor.user().entitySubscriptionIds || [];
    if (entitySubscriptionIds.includes(entityId)) Meteor.users.update(this.userId, { $pull: { entitySubscriptionIds: entityId } });
    else Meteor.users.update(this.userId, { $push: { entitySubscriptionIds: entityId } });
  },
  convertGuestAccountToRealAccount(email, name, password) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check([email, name, password], [String]);
    const user = Meteor.user();
    completeUserProfile(user, email, name);
    Accounts.setPassword(this.userId, password, { logout: false });

    analytics.createUser(user);
    analytics.track(this.userId, '🐣 Sign Up', { source: 'self' });
  },
  teleportUserInLevel(levelId) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(levelId, Match.Id);

    return teleportUserInLevel(levelId, Meteor.userId(), 'teleporter');
  },
  markNotificationAsRead(notificationId) {
    if (!this.userId) return;
    check(notificationId, Match.Id);

    Notifications.update({ _id: notificationId, userId: this.userId }, { $set: { read: true } });
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
  onboardUser({ email, guildName, levelName, levelTemplateId }) {
    if (!this.userId) throw new Meteor.Error('user-required', 'User required');
    if (!Meteor.user().roles?.admin) throw new Meteor.Error('user-unauthorized', 'Unauthorized access');
    check([email, levelName, guildName, levelTemplateId], [String]);

    // create new account & new guild
    let user = Accounts.findUserByEmail(email);
    let passwordURL;

    if (!user) {
      const userId = Accounts.createUser({ email });
      const name = email.split('@')[0];
      Meteor.users.update(userId, { $set: { 'profile.name': name } });

      user = Meteor.users.findOne(userId);

      analytics.createUser(user);
      analytics.track(user._id, '🐣 Sign Up', { source: 'admin' });

      // generate the enrollment link
      const { token } = Accounts.generateResetToken(user._id, email, 'enrollAccount');
      passwordURL = Accounts.urls.enrollAccount(token);
    }

    const guildId = Guilds.id();
    Guilds.insert({
      _id: guildId,
      name: levelName,
      owners: [user._id],
      createdAt: new Date(),
      createdBy: user._id,
    });

    Meteor.users.update(user._id, { $set: { guildId } });

    // create level
    const levelId = createLevel({ templateId: levelTemplateId, name: levelName, guildId, createdBy: user._id });
    Levels.update(levelId, { $set: { hide: true, createdBy: user._id, guildId } });

    teleportUserInLevel(levelId, user._id, 'onboarding');

    return { user, levelId, passwordURL };
  },
});

Meteor.users.find({ 'status.online': true }).observeChanges({
  added(id) {
    const user = Meteor.users.findOne(id);
    if (!user || !user.status.lastLogoutAt) return;

    const { respawnDelay } = Meteor.settings;
    if (!respawnDelay) return;

    const diffInMinutes = (Date.now() - new Date(user.status.lastLogoutAt).getTime()) / 60000;
    if (diffInMinutes < respawnDelay) return;

    const levelId = user.profile.levelId || Meteor.settings.defaultLevelId;
    const currentLevel = Levels.findOne(levelId);
    if (currentLevel?.spawn) {
      const spawnPosition = levelSpawnPosition(levelId);
      Meteor.users.update(user._id, { $set: { 'profile.x': spawnPosition.x, 'profile.y': spawnPosition.y } });
    }
  },
  removed(id) {
    Meteor.users.update(id, { $set: { 'status.lastLogoutAt': new Date() } });
  },
});
