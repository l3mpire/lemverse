import { canEditLevel, canEditGuild, canModerateLevel, canModerateUser, canEditUserPermissions, currentLevel, isLevelOwner } from '../../lib/misc';

const tabs = Object.freeze({
  level: 'level',
  team: 'team',
});

const userListTabKey = 'userListTab';
const userFields = { 'status.online': 1, 'profile.name': 1, 'profile.x': 1, 'profile.y': 1, 'profile.levelId': 1, roles: 1, guildId: 1 };

const users = (mode, guildId) => {
  let filters = { 'profile.guest': { $not: true } };
  if (mode === tabs.level) {
    const { levelId } = Meteor.user({ fields: { 'profile.levelId': 1 } }).profile;
    filters = { ...filters, 'status.online': true, 'profile.levelId': levelId };
  } else if (mode === tabs.team) filters = { ...filters, $and: [{ guildId: { $exists: true } }, { guildId }] };

  return Meteor.users.find(filters, { sort: { 'profile.name': 1 }, fields: userFields });
};

Template.userListEntry.helpers({
  admin() { return this.user.roles?.admin; },
  canEditLevel() { return canEditLevel(this.user, this.level); },
  canModerateUser() {
    if (!this.canModerateLevel) return false;

    return canModerateUser(Meteor.user({ fields: { guildId: 1, roles: 1 } }), this.user);
  },
  guildName() { return Guilds.findOne(this.user.guildId)?.name; },
  levelOwner() { return isLevelOwner(this.user, this.level); },
  modules() { return Session.get('userListModules'); },
  user() { return this.user; },
  zone() {
    if (!this.user.status.online) return '-';
    if (this.user.profile.levelId !== Meteor.user({ fields: { 'profile.levelId': 1 } }).profile.levelId) return 'In another level';

    const zone = Zones.findOne({
      x1: { $lte: this.user.profile.x },
      x2: { $gte: this.user.profile.x },
      y1: { $lte: this.user.profile.y },
      y2: { $gte: this.user.profile.y },
    }, { fields: { name: 1, hideName: 1 } });

    if (zone && zone.name && !zone.hideName) return zone.name;

    return '-';
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
  'click .js-guild'() {
    if (this.user.guildId) Session.set('modal', { template: 'teamProfile', teamId: this.user.guildId, append: true });
  },
});

Template.userList.onCreated(function () {
  const user = Meteor.user();
  this.activeTab = new ReactiveVar(localStorage.getItem(userListTabKey) || (user.guildId ? tabs.team : tabs.level));

  const guildIds = Meteor.users.find().map(u => u.guildId).filter(Boolean);
  this.subscribe('guilds', [...new Set(guildIds)]);
});

Template.userList.onDestroyed(function () {
  localStorage.setItem(userListTabKey, this.activeTab.get());
});

Template.userList.helpers({
  activeTab(name) {
    return Template.instance().activeTab.get() === name;
  },
  canEditTeam() {
    const level = currentLevel(Meteor.user());
    const guild = Guilds.findOne(level.guildId);
    if (!guild) return false;

    return canEditGuild(Meteor.user(), guild);
  },
  canEditUserPermissions() {
    return canEditUserPermissions(Meteor.user(), currentLevel(Meteor.user()));
  },
  canModerateLevel() {
    return canModerateLevel(Meteor.user(), currentLevel(Meteor.user()));
  },
  level() {
    return currentLevel(Meteor.user());
  },
  title() {
    const activeTab = Template.instance().activeTab.get();
    return activeTab === tabs.level ? `Users online` : 'Team';
  },
  users() {
    const activeTab = Template.instance().activeTab.get();
    const { guildId } = Meteor.user({ fields: { guildId: 1 } });

    return users(activeTab, guildId)
      .fetch()
      .sort((a, b) => {
        if (a.status.online === b.status.online) return a.profile.name.toLowerCase().localeCompare(b.profile.name.toLowerCase());
        return a.status.online ? -1 : 1;
      });
  },
});

Template.userList.events({
  'click .js-toggle-tab'(event, templateInstance) {
    const { tab } = event.currentTarget.dataset;
    templateInstance.activeTab.set(tab);
  },
  'click .js-team-manage'() {
    Session.set('modal', { template: 'team', scope: 'level', append: true });

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
