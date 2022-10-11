import { formatURL } from '../helpers';

const getUser = template => Meteor.users.findOne(template.data.userId);

Template.userProfile.onCreated(function () {
  const { userId } = this.data;
  if (!userId) return;

  this.guild = new ReactiveVar();

  this.subscribe('userProfile', userId, () => {
    const user = Meteor.users.findOne(userId);

    if (!user.guildId) {
      this.guild.set(undefined);
      return;
    }

    Meteor.call('guilds', [user.guildId], (error, guilds) => {
      if (!guilds.length) return;
      this.guild.set(guilds[0]);
    });
  });
});

Template.userProfile.helpers({
  guild() { return Template.instance().guild.get()?.name; },
  profile() { return getUser(Template.instance()).profile; },
  title() {
    const template = Template.instance();
    return getUser(template).profile.name;
  },
  myProfile() { return Meteor.userId() === Template.instance().data.userId; },
  age() { return moment().diff(getUser(Template.instance()).createdAt, 'days'); },
  website() {
    const { website } = getUser(Template.instance()).profile;
    if (!website) return null;

    const url = formatURL(website);
    if (!url) return null;

    return url.href;
  },
});

Template.userProfile.events({
  'click .js-title'(event, templateInstance) {
    navigator.clipboard.writeText(getUser(templateInstance)._id).then(() => lp.notif.success('✂️ Identifier copied to your clipboard'));
  },
  'click .js-report'(event, templateInstance) {
    const { userId } = templateInstance.data;
    Session.set('modal', { template: 'report', userId });
  },
});
