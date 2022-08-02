Template.guild.onCreated(function () {
  this.guild = new ReactiveVar();

  Meteor.call('guilds', [this.data.guildId], (error, guilds) => {
    if (error) {
      lp.notif.error('Unable to load the guild for now, please try later');
      return;
    }

    this.guild.set(guilds[0]);
  });
});

Template.guild.helpers({
  guild() { return Template.instance().guild.get(); },
});
