import * as jwt from 'jsonwebtoken';

import { canAccessZone } from '../../../lib/misc';

const { randomUUID } = require('crypto');

const computeRoomName = zone => {
  check(zone._id, Match.Id);

  log('computeRoomName: start', { zoneId: zone._id });

  let { uuid } = zone;
  if (!uuid) {
    uuid = randomUUID();
    Zones.update(zone._id, { $set: { uuid } });
  }

  log('computeRoomName: end', { uuid });

  return uuid;
};

const computeRoomToken = (user, roomName, moderator = false) => {
  let group = 'guest';
  if (user.roles?.admin) group = 'admin';
  else if (moderator) group = 'moderator';

  const { enableAuth, encryptionPassphrase, expiresIn, identifier } = Meteor.settings.meet;
  if (!enableAuth) return undefined;

  const { serverURL } = Meteor.settings.public.meet;

  return jwt.sign({
    context: {
      user: {
        id: user._id,
        name: user.profile.name,
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
};

Meteor.methods({
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

    if (!canAccessZone(zone, user)) {
      log('computeMeetRoomAccess: user not allowed');
      throw new Meteor.Error('not-allowed', 'User not allowed in the zone');
    }

    const moderator = user.roles?.admin || level.guildId === user.guildId;
    const roomName = computeRoomName(zone);
    const token = computeRoomToken(user, roomName, moderator);

    log('computeMeetRoomAccess: end', { roomName, token });

    return { roomName, token };
  },
});

export {
  computeRoomName,
  computeRoomToken,
};
