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

    const { name } = getUser(template).profile;
    if (!Meteor.user().roles?.admin) return name;

    return `${name} (${template.data.userId})`;
  },
  age() { return moment().diff(getUser(Template.instance()).createdAt, 'days'); },
  editionAllowed() { return Template.instance().data.userId === Meteor.userId(); },
  website() {
    const { website } = getUser(Template.instance()).profile;
    if (!website) return null;

    const url = formatURL(website);
    if (!url) return null;

    return url.href;
  },
});

Template.userProfile.events({
  'input .js-company'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.company.name': value } });
    return false;
  },
  'input .js-position'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return false;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.company.position': value } });
    return false;
  },
  'blur .js-website'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;

    if (value) {
      const url = formatURL(value);
      if (!url) {
        lp.notif.error('invalid website URL');
        Meteor.users.update(Meteor.userId(), { $unset: { 'profile.website': 1 } });
        return null;
      }

      Meteor.users.update(Meteor.userId(), { $set: { 'profile.website': url.href } });
    } else Meteor.users.update(Meteor.userId(), { $unset: { 'profile.website': 1 } });

    return false;
  },
  'input .js-bio'(event) {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    if (!value) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.bio': value } });
  },
  'input .js-avatar'(event) {
    event.preventDefault();
    event.stopPropagation();
    const avatar = event.target.value;
    if (!avatar) return;

    Meteor.users.update(Meteor.userId(), { $set: { 'profile.avatar': avatar } });
  },
  'click #modal-title'(event, templateInstance) {
    navigator.clipboard.writeText(getUser(templateInstance)._id).then(() => lp.notif.success('✂️ Identifier copied to your clipboard'));
  },
});
