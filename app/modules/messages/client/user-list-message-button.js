Template.userListMessageButton.events({
  'click .js-send-message'(e) {
    e.preventDefault();
    e.stopPropagation();

    Session.set('modal', undefined);
    const channel = [this.user._id, Meteor.userId()].sort().join(';');
    messagesModule.changeMessagesChannel(channel);
    openConsole();
  },
});

Template.userListMessageButton.helpers({
  show() { return this.user._id !== Meteor.userId() && !Meteor.user().profile.guest; },
});
