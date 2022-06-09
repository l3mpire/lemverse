const { randomUUID } = require('crypto');

const privateFields = { uuid: 0 };

Meteor.publish('zones', function (levelId) {
  check(levelId, Match.Maybe(String));
  if (!this.userId) return undefined;
  if (!levelId) levelId = Meteor.settings.defaultLevelId;

  return Zones.find({ levelId }, { fields: privateFields });
});

Meteor.methods({
  computeRoomName(zoneId) {
    log('computeRoomName: start', { zoneId, userId: this.userId });
    check(zoneId, Match.Id);

    if (!canAccessZone(zoneId, this.userId)) {
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
  },
});
