const limit = 20;

Meteor.publish('messages', function (channel) {
  check(channel, String);
  if (!this.userId) return undefined;

  return Messages.find({ channel }, { sort: { createdAt: -1 }, limit });
});
