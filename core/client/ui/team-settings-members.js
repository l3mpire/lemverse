const users = guildId => Meteor.users.find({ guildId }, { sort: { 'profile.name': 1 } });

Template.teamSettingsMembers.onCreated(function () {
  this.guildId = Meteor.user().guildId;
});

Template.teamSettingsMembers.helpers({
  teamMembers() {
    return users(Template.instance().guildId).fetch()
      .sort((a, b) => a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase()));
  },
});

Template.teamSettingsMembers.events({
  'click .js-add-team-user'() {
    Session.set('modal', { template: 'userListSelection', scope: 'level', append: true });

    Tracker.autorun(computation => {
      if (Session.get('modal')?.template === 'userListSelection') return;
      computation.stop();

      Tracker.nonreactive(() => {
        const usersSelected = Session.get('usersSelected') || [];
        if (!usersSelected.length) return;

        const { guildId } = Meteor.user();
        Meteor.call('addGuildUsers', guildId, usersSelected, error => {
          if (error) lp.notif.error(error);
        });
      });
    });
  },
});

Template.teamMemberEntry.onCreated(function () {
  const defaultUsersSelected = (this.data.selectedUsers || []).reduce((acc, curr) => ({ ...acc, [curr]: true }), {});
  this.selectedUsers = new ReactiveVar(defaultUsersSelected);
});

Template.teamMemberEntry.helpers({
  user() { return this.user; },
  selected() {
    return !!Template.instance().selectedUsers.get()[this._id];
  },
});

const toggleUserSelection = (userId, template) => {
  const selectedUsers = template.selectedUsers.get();
  if (selectedUsers[userId]) {
    delete selectedUsers[userId];
    template.selectedUsers.set(selectedUsers);
  } else template.selectedUsers.set({ ...selectedUsers, [userId]: true });
};

Template.teamMemberEntry.events({
  'click .js-selectable'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const { userId } = event.currentTarget.dataset;
    toggleUserSelection(userId, templateInstance);
  },
  'click .js-remove-team-user'() {
    const msg = Meteor?.settings?.public?.confirmMessage?.delUsers || `Are you sure to remove this user from the team?`;
    lp.notif.confirm('Team member deletion', msg, () => {
      Meteor.call('removeTeamUsers', Meteor.user().guildId, [this.user._id], error => {
        if (error) lp.notif.error(error);
      });
    });
  },
});
