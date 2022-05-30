const users = (ignoredUsers = []) => {
  const { guildId } = Meteor.user();
  const filters = { _id: { $nin: ignoredUsers }, 'profile.guest': { $not: true }, $and: [{ guildId: { $exists: true } }, { guildId }] };

  return Meteor.users.find(filters, { sort: { 'profile.name': 1 } });
};

const toggleUserSelection = (userId, template) => {
  const selectedUsers = template.selectedUsers.get();
  if (selectedUsers[userId]) {
    delete selectedUsers[userId];
    template.selectedUsers.set(selectedUsers);
  } else template.selectedUsers.set({ ...selectedUsers, [userId]: true });
};

Template.userListSelection.events({
  'click .js-selectable'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const { userId } = event.currentTarget.dataset;
    toggleUserSelection(userId, templateInstance);
  },
  'click .js-submit'(event, templateInstance) {
    Session.set('usersSelected', Object.keys(templateInstance.selectedUsers.get()));
    closeModal();
  },
});

Template.userListSelection.onCreated(function () {
  Session.set('usersSelected', []);

  const defaultUsersSelected = (this.data.selectedUsers || []).reduce((acc, curr) => ({ ...acc, [curr]: true }), {});
  this.selectedUsers = new ReactiveVar(defaultUsersSelected);
});

Template.userListSelection.helpers({
  users() { return users(this.ignoredUsers).fetch().sort((a, b) => a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase())); },
  selected() { return !!Template.instance().selectedUsers.get()[this._id]; },
  amountSelected() { return Object.keys(Template.instance().selectedUsers.get()).length; },
});
