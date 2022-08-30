import { generateRandomCharacterSkin, levelSpawnPosition } from '../lib/misc';

Accounts.onCreateUser((options, user) => {
  log('onCreateUser', { options, user });
  user._id = `usr_${Random.id()}`;
  if (!Meteor.users.find().count()) { // Set the first account as admin
    user.roles = { admin: true };
  }
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

  if (!user.profile.x) {
    const level = Levels.findOne(Meteor.settings.defaultLevelId);
    const spawnPosition = levelSpawnPosition(level);
    Meteor.users.update(user._id, { $set: { 'profile.x': spawnPosition.x, 'profile.y': spawnPosition.y } });
  }

  if (user.profile.guest) return;

  const isBodyValid = user.profile.body?.includes('chr_');
  if (!isBodyValid) {
    log('onLogin: setting default skin', { userId: user._id, ip: param.connection?.httpHeaders?.['x-forwarded-for'], userAgent: param.connection?.httpHeaders?.['user-agent'], languages: param.connection?.httpHeaders?.['accept-language'] });
    generateRandomCharacterSkin(user._id, Meteor.settings.defaultLevelId);
  }

  analytics.track(user._id, '👋 Sign In', { type: param.type });
});

Accounts.validateLoginAttempt(param => {
  const { user, methodName } = param;
  log('validateLoginAttempt: start', { type: param.type, allowed: param.allowed, methodName, username: param.methodArguments?.[0].user?.username, error: param.error, connection: param.connection, userId: user?._id });

  if (Meteor.settings.forbiddenIPs?.includes(lp.ip(param).ip)) {
    error('validateLoginAttempt: watched ip detected!', { ip: lp.ip(param).ip, userId: user?._id });
    return false;
  }

  return true;
});
