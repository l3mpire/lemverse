Template.userListQuestButton.events({
  'click .js-create-quest'(e) {
    e.preventDefault();
    e.stopPropagation();

    closeModal();
    createQuestDraft([this.user._id], Meteor.userId());
  },
});

Template.userListQuestButton.helpers({
  show() { return this.user._id !== Meteor.userId() && !Meteor.user().profile.guest; },
});
