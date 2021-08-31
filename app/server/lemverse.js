import { PeerServer } from 'peer';

// eslint-disable-next-line new-cap
PeerServer({ port: 7010, path: '/peer' });

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

  return Tiles.find({ levelId }, { fields: { index: 1, x: 1, y: 1, tilesetId: 1, levelId: 1 } });
});

Meteor.publish('levels', function () {
  if (!this.userId) return undefined;

  return Levels.find();
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
    { fields: { 'profile.name': 1 } },
  );
});

Meteor.publish('characters', function () {
  if (!this.userId) return undefined;

  return Characters.find();
});

Meteor.methods({
  toggleLevelEditionPermission(userId) {
    check(userId, String);
    if (!isEditionAllowed(this.userId)) return;

    const { levelId } = Meteor.user().profile;
    if (!isEditionAllowed(userId)) Levels.update(levelId, { $addToSet: { editorUserIds: { $each: [userId] } } });
    else Levels.update(levelId, { $pull: { editorUserIds: userId } });
  },
  createLevel(templateId = undefined) {
    const newLevelId = Levels.id();
    Levels.insert({
      _id: newLevelId,
      name: `${Meteor.user().profile.name || Meteor.user().username}'s world`,
      spawn: { x: 200, y: 200 },
      createdAt: new Date(),
      createdBy: Meteor.userId(),
    });

    if (templateId) {
      const tiles = Tiles.find({ levelId: templateId }).fetch();
      const zones = Zones.find({ levelId: templateId }).fetch();

      tiles.forEach(tile => {
        Tiles.insert({
          ...tile,
          _id: Tiles.id(),
          createdAt: new Date(),
          createdBy: Meteor.userId(),
          levelId: newLevelId,
        });
      });

      zones.forEach(zone => {
        Zones.insert({
          ...zone,
          _id: Zones.id(),
          createdAt: new Date(),
          createdBy: Meteor.userId(),
          levelId: newLevelId,
        });
      });
    } else {
      const { levelId } = Meteor.user().profile;

      Zones.insert({
        _id: Zones.id(),
        adminOnly: false,
        createdAt: new Date(),
        createdBy: Meteor.userId(),
        levelId: newLevelId,
        targetedLevelId: levelId,
        name: 'Previous world',
        x1: 10,
        x2: 110,
        y1: 10,
        y2: 110,
      });
    }

    return newLevelId;
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
    const { url, path, config, port, secret } = Meteor.settings.peer.server;
    const { username, password: credential } = generateTURNCredentials(this.userId, secret);

    const iceServers = config.iceServers.map(({ urls, auth }) => {
      if (!auth) return { urls };
      return { urls, username, credential };
    });

    return {
      url,
      port,
      path,
      config: {
        ...config,
        iceServers,
      },
    };
  },
  updateLevel(name, position) {
    if (!this.userId) throw new Meteor.Error('missing-user', 'A valid user is required');
    check(name, String);
    check(position, { x: Number, y: Number });

    const { levelId } = Meteor.user().profile;
    const level = Levels.findOne(levelId);
    if (!level || level.sandbox) throw new Meteor.Error('invalid-level', 'A valid level is required');
    if (!isEditionAllowed(this.userId)) throw new Meteor.Error('permission-error', `You can't edit this level`);

    Levels.update(levelId, { $set: { name, spawn: { x: position.x, y: position.y } } });
  },
  increaseLevelVisits(levelId) {
    check(levelId, String);
    Levels.update(levelId, { $inc: { visit: 1 } });
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

// eslint-disable-next-line no-undef
setSpawnLevelXY = () => {
  const user = Meteor.user();
  log('setSpawnLevelXY: start', { userId: user._id });
  if (!user) return;
  Levels.update({ _id: user.profile.levelId }, { $set: { spawn: { x: user.profile.x, y: user.profile.y } } });
};
