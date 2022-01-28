Meteor.publish('messages', function (zoneId) {
  check(zoneId, String);
  if (!this.userId) return undefined;

  return Messages.find({ zoneId });
});
