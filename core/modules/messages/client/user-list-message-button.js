import { guestAllowed } from '../../../lib/misc';
import { permissionType } from '../misc';

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
  show() {
    if (this.user._id === Meteor.userId()) return false;
    return this.user.profile.guest && guestAllowed(permissionType);
  },
});
