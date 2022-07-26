const tabs = Object.freeze({
  level: 'level',
  guild: 'guild',
});

const userListTabKey = 'userListTab';

const users = (mode, guildId) => {
  let filters = { 'profile.guest': { $not: true } };
  if (mode === tabs.level) {
    const { levelId } = Meteor.user().profile;
    filters = { ...filters, 'status.online': true, 'profile.levelId': levelId };
  } else if (mode === tabs.guild) filters = { ...filters, $and: [{ guildId: { $exists: true } }, { guildId }] };

  return Meteor.users.find(filters, { sort: { 'profile.name': 1 } });
};

Template.userListEntry.helpers({
  canKick() { return (Meteor.user().roles?.admin || Meteor.user().guildId === userLevel(Meteor.userId()).guildId) && !this.user.roles?.admin && Meteor.userId() !== this.user._id && this.user.guildId !== Meteor.user().guildId; },
  admin() { return this.user.roles?.admin; },
  canEditLevel() { return isEditionAllowed(this.user._id); },
  guild() { return Guilds.findOne(this.user.guildId)?.name; },
  levelOwner() { return isLevelOwner(this.user._id); },
  modules() { return Session.get('userListModules'); },
  user() { return this.user; },
  zone() {
    if (!this.user.status.online) return '-';
    return this.user.profile.zoneName || '-';
  },
});

Template.userListEntry.events({
  'click .js-toggle-edition'() { Meteor.call('toggleLevelEditionPermission', this.user._id); },
  'click .js-kick-user'() {
    Meteor.call('kickUser', this.user._id, err => {
      if (err) { lp.notif.error(err); return; }

      lp.notif.success('Successfully Kicked!');
    });
  },
  'click .js-profile'() { Session.set('modal', { template: 'userProfile', userId: this.user._id, append: true }); },
  'click .js-guild'() { Session.set('modal', { template: 'guild', guildId: this.user.guildId, append: true }); },
});

Template.userList.onCreated(function () {
  const user = Meteor.user();
  this.activeTab = new ReactiveVar(localStorage.getItem(userListTabKey) || (user.guildId ? tabs.guild : tabs.level));
  this.hasLevelRights = user.roles?.admin || isLevelOwner(user._id);
  this.subscribe('guilds');
});

Template.userList.onDestroyed(function () {
  localStorage.setItem(userListTabKey, this.activeTab.get());
});

Template.userList.helpers({
  canEditPermissions() { return Template.instance().hasLevelRights; },
  users() {
    const { profile: { levelId }, guildId } = Meteor.user();
    const activeTab = Template.instance().activeTab.get();

    return users(activeTab, guildId)
      .fetch()
      .map(usr => {
        if (usr.profile.levelId !== levelId) usr.profile.zoneName = 'In another level';
        else {
          const zone = Zones.findOne({
            x1: { $lte: usr.profile.x },
            x2: { $gte: usr.profile.x },
            y1: { $lte: usr.profile.y },
            y2: { $gte: usr.profile.y },
          });

          if (zone && zone.name && !zone.hideName) usr.profile.zoneName = zone.name;
        }

        return usr;
      })
      .sort((a, b) => {
        if (a.status.online === b.status.online) return a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase());
        return a.status.online ? -1 : 1;
      });
  },
  title() {
    const userOnlineCount = users(tabs.level).count();
    return `Users (${userOnlineCount} online)`;
  },
  activeTab(name) { return Template.instance().activeTab.get() === name; },
  canEditGuild() {
    const user = Meteor.user();
    return canEditGuild(user._id, user.guildId);
  },
});

Template.userList.events({
  'click .js-toggle-tab'(event, templateInstance) {
    const { tab } = event.currentTarget.dataset;
    templateInstance.activeTab.set(tab);
  },
  'click .js-guild-add-users'() {
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
