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
