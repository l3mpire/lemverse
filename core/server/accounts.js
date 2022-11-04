import * as jwt from 'jsonwebtoken';
import { generateRandomCharacterSkin, getSpawnLevel, levelSpawnPosition, completeUserProfile, generateGuestSkin, teleportUserInLevel } from '../lib/misc';

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
    const spawnPosition = levelSpawnPosition(getSpawnLevel(user));
    Meteor.users.update(user._id, { $set: { 'profile.x': spawnPosition.x, 'profile.y': spawnPosition.y } });
  }

  const isBodyValid = user.profile.body?.includes('chr_');
  if (user.profile.guest && user.username) {
    if (!isBodyValid) generateGuestSkin(user);
    return;
  }
  if (!isBodyValid) {
    log('onLogin: setting default skin', { userId: user._id, ip: param.connection?.httpHeaders?.['x-forwarded-for'], userAgent: param.connection?.httpHeaders?.['user-agent'], languages: param.connection?.httpHeaders?.['accept-language'] });
    generateRandomCharacterSkin(user._id, Meteor.settings.defaultLevelId);
  }

  analytics.track(user._id, '👋 Sign In', { type: param.type, guild_id: user.guildId });
  analytics.identify(user);
});

Accounts.validateLoginAttempt(param => {
  const { user, methodName } = param;
  log('validateLoginAttempt: start', { type: param.type, allowed: param.allowed, methodName, username: param.methodArguments?.[0].user?.username, error: param.error, connection: param.connection, userId: user?._id });

  if (Meteor.settings.forbiddenIPs?.includes(lp.ip(param).ip)) {
    error('validateLoginAttempt: watched ip detected!', { ip: lp.ip(param).ip, userId: user?._id });
    return false;
  }
  if (user?.disabled) {
    log('validateLoginAttempt: user account is disabled', { userId: user._id });
    return false;
  }

  return true;
});

const defaultRequestLoginTokenForUser = Meteor.server.method_handlers.requestLoginTokenForUser;
Meteor.server.method_handlers.requestLoginTokenForUser = options => {
  const { email } = options.selector;
  check(email, String);
  const user = Accounts.findUserByEmail(email);
  if (user?.disabled) {
    log('RequestLoginTokenForUser: account is disabled', { userId: user._id });
    Accounts._handleError('User not found');
  }

  return defaultRequestLoginTokenForUser(options);
};

const { updateOrCreateUserFromExternalService } = Accounts;
Accounts.updateOrCreateUserFromExternalService = function (serviceName, serviceData, options) {
  const result = updateOrCreateUserFromExternalService.apply(this, [serviceName, serviceData, options]);
  const user = Meteor.users.findOne(result.userId);
  if (!user.emails) {
    // first login through the sso provider, we proceed to the initialization of the profile
    completeUserProfile(user, serviceData.email, options.profile.name);
  }

  return result;
};

Accounts.registerLoginHandler('jwt', options => {
  const token = options.jwt;
  const secret = Meteor.settings.jwtAuthSecret;
  if (!token || !secret) return undefined;
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    log('JWT invalid login:', err.message);
    Accounts._handleError('Invalid token');
  }
  const user = Meteor.users.findOne({ 'emails.address': decoded.sub });
  if (!user) Accounts._handleError('User not found');
  if (decoded.level_id) {
    const level = Levels.findOne(decoded.level_id) || getSpawnLevel(user);
    teleportUserInLevel(user, level, 'jwt-login');
  }
  return { userId: user._id };
});
