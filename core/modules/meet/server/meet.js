import * as jwt from 'jsonwebtoken';

const { randomUUID } = require('crypto');

const computeRoomName = (zoneId, userId) => {
  check(zoneId, Match.Id);

  log('computeRoomName: start', { zoneId, userId });

  if (!canAccessZone(zoneId, userId)) {
    log('computeRoomName: user not allowed');
    throw new Meteor.Error('not-allowed', 'User not allowed in the zone');
  }

  const zone = Zones.findOne(zoneId);
  let { uuid } = zone;
  if (!uuid) {
    uuid = randomUUID();
    Zones.update(zoneId, { $set: { uuid } });
  }

  log('computeRoomName: end', { uuid });

  return uuid;
};

Meteor.methods({
  // todo: remove. Will be deprecated with the token feature
  computeRoomName(zoneId) {
    if (!this.userId) return undefined;
    check(zoneId, Match.Id);

    return computeRoomName(zoneId, this.userId);
  },
  computeMeetRoomAccess(zoneId) {
    if (!this.userId) return undefined;
    check(zoneId, Match.Id);

    log('computeMeetRoomAccess: start', { zoneId, userId: this.userId });

    const zone = Zones.findOne(zoneId);
    if (!zone) throw new Meteor.Error('not-found', 'Zone not found');
    if (!zone.roomName) throw new Meteor.Error('invalid-zone', 'This zone is not a meet zone');

    const level = Levels.findOne(zone.levelId);
    if (!level) throw new Meteor.Error('not-found', 'Level not found');

    const user = Meteor.user();
    if (user.profile.levelId !== level._id) throw new Meteor.Error('invalid-action', 'Access from another level deny');

    const moderator = user.roles?.admin || level.guildId === user.guildId;
    let group = 'guest';
    if (user.roles?.admin) group = 'admin';
    else if (moderator) group = 'moderator';

    const { encryptionPassphrase, expiresIn, identifier } = Meteor.settings.meet;
    const { serverURL } = Meteor.settings.public.meet;
    const roomName = computeRoomName(zoneId, this.userId);

    const token = jwt.sign({
      context: {
        user: {
          id: Meteor.userId(),
          name: user._id,
          email: user.emails[0].address,
        },
        group,
      },
      aud: identifier,
      iss: Meteor.settings.public.lp.product,
      sub: serverURL,
      room: roomName,
      moderator,
    }, encryptionPassphrase, { expiresIn });

    log('computeMeetRoomAccess: end', { roomName, token });

    return { room: roomName, token };
  },
});
