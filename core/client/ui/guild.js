const guild = template => Guilds.findOne(template.data.guildId);

Template.guild.onCreated(function () {
  this.subscribe('guilds');
});

Template.guild.helpers({
  title() { return guild(Template.instance())?.name; },
  description() { return guild(Template.instance())?.description; },
  website() { return guild(Template.instance())?.website; },
  logo() { return guild(Template.instance())?.logo; },
});
