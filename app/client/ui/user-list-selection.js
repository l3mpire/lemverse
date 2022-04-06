const users = () => {
  const { guildId } = Meteor.user();
  const filters = { 'profile.guest': { $not: true }, $and: [{ guildId: { $exists: true } }, { guildId }] };

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
  'click .js-selectable'(e, template) {
    e.preventDefault();
    e.stopPropagation();

    const { userId } = e.currentTarget.dataset;
    toggleUserSelection(userId, template);
  },
  'click .js-submit'() {
    Session.set('modal', undefined);
    // todo: save selected users somewhere
  },
});

Template.userListSelection.onCreated(function () {
  this.selectedUsers = new ReactiveVar({});
});

Template.userListSelection.helpers({
  users() { return users().fetch().sort((a, b) => a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase())); },
  selected() { return !!Template.instance().selectedUsers.get()[this._id]; },
  amountSelected() { return Object.keys(Template.instance().selectedUsers.get()).length; },
});
