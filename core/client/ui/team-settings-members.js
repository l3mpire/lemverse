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


Template.teamMemberEntry.helpers({
  user() { return this.user; },
});

Template.teamMemberEntry.events({
  'click .js-remove-team-user'() {
    lp.notif.confirm('Team member deletion', `Are you sure to remove this user from the team?`, () => {
      Meteor.call('removeTeamUser', Meteor.user().guildId, this.user._id, error => {
        if (error) lp.notif.error(error);
      });
    });
  },
});
