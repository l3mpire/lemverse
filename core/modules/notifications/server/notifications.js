Meteor.publish('notifications', function () {
  if (!this.userId) return undefined;

  return Notifications.find({ userId: this.userId });
});
