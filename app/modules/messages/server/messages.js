const limit = 20;

Meteor.publish('messages', function (zoneId) {
  check(zoneId, String);
  if (!this.userId) return undefined;

  return Messages.find({ zoneId }, { sort: { createdAt: -1 }, limit });
});
