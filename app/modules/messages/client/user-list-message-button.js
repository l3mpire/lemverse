Template.userListMessageButton.events({
  'click .js-send-message'(event) {
    event.preventDefault();
    event.stopPropagation();

    closeModal();
    const channel = [this.user._id, Meteor.userId()].sort().join(';');
    messagesModule.changeMessagesChannel(channel);
    openConsole();
  },
});

Template.userListMessageButton.helpers({
  show() { return this.user._id !== Meteor.userId() && !Meteor.user().profile.guest; },
});
