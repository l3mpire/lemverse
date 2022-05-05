const { randomUUID } = require('crypto');

const privateFields = { uuid: 0 };

Meteor.publish('zones', function (levelId) {
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Zones.find({ levelId }, { fields: privateFields });
});

Meteor.methods({
  computeRoomName(zoneId) {
    log('computeRoomName: start', { zoneId });
    check(zoneId, String);

    const zone = Zones.findOne(zoneId);
    if (!zone) {
      log('computeRoomName: invalid zone', { zoneId });
      throw new Meteor.Error('zone-invalid', 'Invalid zoneId');
    }

    const user = Meteor.user();
    if (!userAllowedInZone(user, zone)) {
      log('computeRoomName: user not allowed', { zone, user });
      throw new Meteor.Error('not-allowed', 'User not allowed in the zone');
    }

    let { uuid } = zone;
    if (!uuid) {
      uuid = randomUUID();
      Zones.update(zone._id, { $set: { uuid } });
    }

    log('computeRoomName: end', { uuid });

    return uuid;
  },
});
