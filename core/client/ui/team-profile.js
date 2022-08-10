Template.teamProfile.onCreated(function () {
  this.team = new ReactiveVar();

  Meteor.call('guilds', [this.data.teamId], (error, teams) => {
    if (error) {
      lp.notif.error('Unable to load the team for now, please try later');
      return;
    }

    this.team.set(teams[0]);
  });
});

Template.teamProfile.helpers({
  team() { return Template.instance().team.get(); },
  title() { return Template.instance().team.get()?.name || 'Team'; },
});
