const scopes = Object.freeze({
  level: 'level',
  guild: 'guild',
});

const users = (scope = scopes.guild, ignoredUsers = []) => {
  const filters = { _id: { $nin: ignoredUsers }, 'profile.guest': { $not: true } };
  if (scope === scopes.guild) filters.guildId = Meteor.user().guildId;
  else filters.guildId = { $exists: false };

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
    const userList = Object.keys(templateInstance.selectedUsers.get());
    const msg = Meteor?.settings?.public?.confirmMessage?.addUsers ? Meteor.settings.public.confirmMessage.addUsers : `Are you sure to add these users to the team?`;
    lp.notif.confirm('Team member add', msg, () => {
      Session.set('usersSelected', userList);
      closeModal();
    });
  },
});

Template.userListSelection.onCreated(function () {
  Session.set('usersSelected', []);

  const defaultUsersSelected = (this.data.selectedUsers || []).reduce((acc, curr) => ({ ...acc, [curr]: true }), {});
  this.selectedUsers = new ReactiveVar(defaultUsersSelected);
  this.scope = this.data.scope || scopes.guild;
});

Template.userListSelection.helpers({
  users() {
    return users(Template.instance().scope, this.ignoredUsers)
      .fetch()
      .sort((a, b) => a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase()));
  },
  selected() { return !!Template.instance().selectedUsers.get()[this._id]; },
  amountSelected() { return Object.keys(Template.instance().selectedUsers.get()).length; },
});
