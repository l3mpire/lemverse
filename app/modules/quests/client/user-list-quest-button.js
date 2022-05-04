Template.userListQuestButton.events({
  'click .js-create-quest'(e) {
    e.preventDefault();
    e.stopPropagation();

    Session.set('modal', undefined);
    createQuestDraft([this.user._id], Meteor.userId());
  },
});

Template.userListQuestButton.helpers({
  show() { return this.user._id !== Meteor.userId() && !Meteor.user().profile.guest; },
});
