import { PeerServer } from 'peer';

if (Meteor.settings.peer.server.start) {
  // eslint-disable-next-line new-cap
  PeerServer({ ...Meteor.settings.peer.server, path: Meteor.settings.peer.path });
}

Accounts.emailTemplates.from = Meteor.settings.email.from;
AccountsGuest.enabled = true;
AccountsGuest.forced = true;
AccountsGuest.name = true;

Meteor.publish('notifications', function () {
  if (!this.userId) return undefined;

  return Notifications.find({ userId: this.userId });
});

Meteor.publish('tiles', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Tiles.find({ levelId, $or: [{ invisible: false }, { invisible: { $exists: false } }] }, { fields: { index: 1, x: 1, y: 1, tilesetId: 1, levelId: 1, metadata: 1 } });
});

Meteor.publish('entities', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Entities.find({ levelId });
});

Meteor.publish('zones', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Zones.find({ levelId });
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

Meteor.publish('characters', function () {
  if (!this.userId) return undefined;

  return Characters.find();
});

Meteor.methods({
  teleportUserInLevel(levelId) {
    return teleportUserInLevel(levelId, Meteor.userId());
  },
  markNotificationAsRead(notificationId) {
    if (!this.userId) return;
    check(notificationId, String);
    Notifications.update({ _id: notificationId, userId: this.userId }, { $set: { read: true } });
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
  getPeerConfig() {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    const { url, config, port, secret } = Meteor.settings.peer.client;
    const { username, password: credential } = generateTURNCredentials(this.userId, secret);

    const iceServers = config.iceServers.map(({ urls, auth }) => {
      if (!auth) return { urls };
      return { urls, username, credential };
    });

    return {
      url,
      port,
      path: Meteor.settings.peer.path,
      config: {
        ...config,
        iceServers,
      },
    };
  },
});

lp.defer(() => {
  if (Levels.find().count() > 0) return;

  log('creating default level');
  Levels.insert({
    _id: Meteor.settings.defaultLevelId,
    name: 'Default level',
    spawn: { x: 200, y: 200 },
    createdAt: new Date(),
  });
});
