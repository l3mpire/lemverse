Notifications = lp.collectionRegister('notifications', 'not', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId, notification) { return notification.userId === userId; },
  remove(userId, notification) { return notification.userId === userId; },
});
