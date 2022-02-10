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
    updateSkin(user, Meteor.settings.defaultLevelId);
  }
});

Meteor.publish('users', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Meteor.users.find(
    { 'status.online': true, 'profile.levelId': levelId },
    { fields: { options: 1, profile: 1, roles: 1, status: { online: 1 }, beta: 1, inventory: 1 } },
  );
});

Meteor.publish('selfUser', function () {
  if (!this.userId) return '';

  return Meteor.users.find(
    this.userId,
    { fields: { emails: 1, options: 1, profile: 1, roles: 1, status: 1, beta: 1 } },
  );
});

Meteor.publish('usernames', function (userIds) {
  if (!this.userId) return undefined;
  check(userIds, [String]);

  return Meteor.users.find(
    { _id: { $in: userIds } },
    { fields: { 'profile.name': 1, 'profile.body': 1, 'profile.hair': 1, 'profile.outfit': 1, 'profile.eye': 1, 'profile.accessory': 1 } },
  );
});

Meteor.publish('userProfile', function (userId) {
  if (!this.userId) return undefined;
  check(userId, String);

  return Meteor.users.find(userId, { fields: { 'profile.name': 1, 'profile.company': 1, 'profile.bio': 1, 'profile.website': 1, createdAt: 1 } });
});

const dropInventoryItem = (itemId, data = {}) => {
  log('dropInventoryItem: start', { itemId, data });
  const item = Items.findOne(itemId);
  if (!item) throw new Meteor.Error(404, 'Item not found.');

  const user = Meteor.user();
  if (!user.inventory || user.inventory[itemId] < 1) throw new Meteor.Error(404, 'Item not found in the inventory.');

  const itemsEdited = removeFromInventory(user, [{ itemId, amount: data.amount || 1 }]);
  if (Object.keys(itemsEdited).length === 1) createEntityFromItem(item, data);
  else throw new Meteor.Error(404, 'Inventory not updated: item not found in the user inventory.');

  return itemsEdited;
};

Meteor.methods({
  dropInventoryItem(itemId, data = {}) {
    check(itemId, String);
    check(data, Object);

    return dropInventoryItem(itemId, data);
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
    updateSkin(Meteor.user(), profile.levelId);
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
});

Meteor.users.find({ 'status.online': true }).observeChanges({
  added(id) {
    const user = Meteor.users.findOne(id);
    if (!user || !user.status.lastLogoutAt) return;

    const { respawnDelay } = Meteor.settings;
    if (!respawnDelay) return;

    const diffInMinutes = ((new Date()).getTime() - new Date(user.status.lastLogoutAt).getTime()) / 60000;
    if (diffInMinutes < respawnDelay) return;

    const levelId = user.profile.levelId || Meteor.settings.defaultLevelId;
    const currentLevel = Levels.findOne(levelId);
    if (currentLevel?.spawn) Meteor.users.update(user._id, { $set: { 'profile.x': currentLevel.spawn.x, 'profile.y': currentLevel.spawn.y } });
  },
  removed(id) {
    Meteor.users.update(id, { $set: { 'status.lastLogoutAt': new Date() } });
  },
});
