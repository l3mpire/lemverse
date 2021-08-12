Template.notification.helpers({
  message() { return notificationMessage; },
});

Template.notification.events({
  'click .close'() {
    Session.set('displayNotification', false);
  },
});
