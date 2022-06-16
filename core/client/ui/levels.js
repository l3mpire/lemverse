const listMode = 'list';

const levelQueryFilters = ignoredLevelId => ({
  _id: { $ne: ignoredLevelId || Meteor.settings.public.templateLevelId },
  $or: [
    { $or: [{ hide: false }, { hide: { $exists: false } }] },
    { createdBy: Meteor.userId() },
  ],
});

const askLoadLevel = (levelId, incrementVisit = false) => {
  if (Meteor.user().profile.levelId === levelId) return;

  if (incrementVisit) Meteor.call('increaseLevelVisits', levelId);

  if (window.self !== window.top) {
    const data = { userId: Meteor.userId(), levelId, type: 'load-level' };
    window.parent.document.dispatchEvent(new CustomEvent(eventTypes.onPopInEvent, { detail: data }));
  } else {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.levelId': levelId } });
  }
};

Template.levels.onCreated(function () {
  this.subscribe('levels');
  this.loading = new ReactiveVar(false);
  this.tab = new ReactiveVar(listMode);

  this.autorun(() => {
    const levels = Levels.find(levelQueryFilters(), { fields: { createdBy: 1 } }).fetch();
    const userIds = levels.map(level => level.createdBy).filter(Boolean);
    if (userIds?.length) this.subscribe('usernames', userIds);
  });
});

Template.levels.events({
  'click .js-create-level'(event, templateInstance) {
    templateInstance.loading.set(true);
    Meteor.call('createLevel', this._id, (err, levelId) => {
      templateInstance.loading.set(false);
      if (err) { error(err); return; }

      // we need to wait collections update on the simulation part, todo: find a better way to handle that
      setTimeout(() => askLoadLevel(levelId), 500);
    });
  },
  'click .js-tab-switcher'(event, templateInstance) {
    const { mode } = event.target.dataset;
    templateInstance.tab.set(mode);
  },
  'click .js-level-select'(event, templateInstance) {
    if (window.self !== window.top) templateInstance.loading.set(true);
    const { levelId } = event.target.dataset;
    askLoadLevel(levelId, true);
  },
});

Template.levels.helpers({
  isLevelOwner(level) { return Meteor.userId() === level.createdBy; },
  levels() {
    const currentLevelId = Meteor.user()?.profile.levelId;
    const levels = Levels.find(levelQueryFilters(currentLevelId), { sort: { visit: -1 } }).fetch();
    const userId = Meteor.userId();

    return levels.sort((a, b) => {
      if (a.createdBy === userId && b.createdBy !== userId) return -1;
      if (b.createdBy === userId && a.createdBy !== userId) return 1;

      return b.visit - a.visit;
    });
  },
  levelName(level) {
    if (level.name) return level.name;

    const user = Meteor.users.findOne(level.createdBy);
    if (!user && level.createdBy) return `${level.createdBy}'s world`;
    else if (!user) return `Guest's world`;

    return `${user.profile.name}'s world`;
  },
  levelVisitCount(level) { return level.visit || 0; },
  loading() { return Template.instance().loading.get(); },
  showList() { return Template.instance().tab.get() === listMode; },
  showCreate() { return Template.instance().tab.get() !== listMode; },
  restrictedLevelCreation() {
    const { permissions } = Meteor.settings.public;
    if (!permissions) return false;

    return !permissions.allowLevelCreation;
  },
  contactURL() { return Meteor.settings.public.permissions?.contactURL; },
});
