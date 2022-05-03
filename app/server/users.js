const mainFields = { options: 1, profile: 1, roles: 1, status: { online: 1 }, beta: 1, guildId: 1 };

isolateUser = userId => {
  check(userId, String);
  if (!isEditionAllowed(Meteor.userId())) throw new Meteor.Error('missing-permissions', `You don't have the permissions`);

  const { levelId } = Meteor.user().profile;
  const { isolationPosition } = Levels.findOne(levelId);
  if (!isolationPosition) throw new Meteor.Error('missing-isolation-position', 'isolationPosition not set on the level');
  Meteor.users.update(userId, { $set: { 'profile.x': +isolationPosition.x, 'profile.y': +isolationPosition.y } });
};

Accounts.onCreateUser((options, user) => {
  log('onCreateUser', { options, user });
  user._id = `usr_${Random.id()}`;
  user.profile = {
    ...options.profile,
    levelId: Meteor.settings.defaultLevelId,
  };

  return user;
});

Accounts.validateNewUser(() => true);

Accounts.onLogin(param => {
  const user = Meteor.users.findOne(param.user._id);

  log('onLogin: start', { userId: user._id, ip: param.connection?.httpHeaders?.['x-forwarded-for'], userAgent: param.connection?.httpHeaders?.['user-agent'], languages: param.connection?.httpHeaders?.['accept-language'] });

  const currentLevel = Levels.findOne(Meteor.settings.defaultLevelId);
  if (currentLevel?.spawn && !user.profile?.x) {
    Meteor.users.update(user._id, { $set: { 'profile.x': currentLevel.spawn.x, 'profile.y': currentLevel.spawn.y } });
  }

  if (user.profile.guest) return;

  const isBodyValid = user.profile.body?.includes('chr_');
  if (!isBodyValid) {
    log('onLogin: setting default skin', { userId: user._id, ip: param.connection?.httpHeaders?.['x-forwarded-for'], userAgent: param.connection?.httpHeaders?.['user-agent'], languages: param.connection?.httpHeaders?.['accept-language'] });
    generateRandomCharacterSkin(user, Meteor.settings.defaultLevelId);
  }
});

Meteor.publish('users', function (levelId) {
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
    { fields: { emails: 1, options: 1, profile: 1, roles: 1, status: 1, beta: 1, entitySubscriptionIds: 1, zoneLastSeenDates: 1, inventory: 1 } },
  );
});

Meteor.publish('usernames', function (userIds) {
  if (!this.userId) return undefined;
  check(userIds, [String]);

  return Meteor.users.find(
    { _id: { $in: userIds } },
    { fields: mainFields },
  );
});

Meteor.publish('userProfile', function (userId) {
  if (!this.userId) return undefined;
  check(userId, String);

  return Meteor.users.find(userId, { fields: { ...mainFields, createdAt: 1 } });
});

Meteor.methods({
  toggleEntitySubscription(entityId) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');

    const entitySubscriptionIds = Meteor.user().entitySubscriptionIds || [];
    if (entitySubscriptionIds.includes(entityId)) Meteor.users.update(this.userId, { $pull: { entitySubscriptionIds: entityId } });
    else Meteor.users.update(this.userId, { $push: { entitySubscriptionIds: entityId } });
  },
  convertGuestAccountToRealAccount(email, name, password) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check([email, name, password], [String]);

    const { profile } = Meteor.user();
    try {
      Promise.await(Meteor.users.update(this.userId, {
        $set: {
          'emails.0.address': email,
          profile: {
            ...profile,
            name,
            shareAudio: true,
            shareVideo: true,
          },
        },
      }));
    } catch (err) { throw new Meteor.Error('email-duplicate', 'Email already exists'); }

    // ensures the logged user don't have guest attributes anymore
    Meteor.users.update(this.userId, { $unset: { 'profile.guest': true, username: true } });
    generateRandomCharacterSkin(Meteor.user(), profile.levelId);
    Accounts.setPassword(this.userId, password, { logout: false });
  },
  teleportUserInLevel(levelId) {
    return teleportUserInLevel(levelId, Meteor.userId());
  },
  markNotificationAsRead(notificationId) {
    if (!this.userId) return;
    check(notificationId, String);
    Notifications.update({ _id: notificationId, userId: this.userId }, { $set: { read: true } });
  },
  updateZoneLastSeenDate(zoneId, create = false) {
    if (!this.userId) return;
    check(zoneId, String);
    check(create, Boolean);

    const { zoneLastSeenDates } = Meteor.user();
    if (create || zoneLastSeenDates[zoneId]) Meteor.users.update(Meteor.userId(), { $set: { [`zoneLastSeenDates.${zoneId}`]: new Date() } });
  },
  unsubscribeFromZone(zoneId) {
    if (!this.userId) return;
    check(zoneId, String);
    Meteor.users.update(Meteor.userId(), { $unset: { [`zoneLastSeenDates.${zoneId}`]: 1 } });
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
    if (currentLevel?.spawn) Meteor.users.update(user._id, { $set: { 'profile.x': currentLevel.spawn.x, 'profile.y': currentLevel.spawn.y } });
  },
  removed(id) {
    Meteor.users.update(id, { $set: { 'status.lastLogoutAt': new Date() } });
  },
});
