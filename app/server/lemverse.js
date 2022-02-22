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

  return Tiles.find({ levelId, $or: [{ invisible: false }, { invisible: { $exists: false } }] }, { fields: { index: 1, x: 1, y: 1, tilesetId: 1, metadata: 1 } });
});

Meteor.publish('zones', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Zones.find({ levelId });
});

Meteor.publish('characters', function () {
  if (!this.userId) return undefined;

  return Characters.find();
});

Meteor.methods({
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
