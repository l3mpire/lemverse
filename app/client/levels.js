const listMode = 'list';

const askLoadLevel = (levelId, incrementVisit = false) => {
  if (incrementVisit) Meteor.call('increaseLevelVisits', levelId);

  if (window.self !== window.top) {
    const data = { userId: Meteor.userId(), levelId, type: 'load-level' };
    window.parent.document.dispatchEvent(new CustomEvent('pop-in-event', { detail: data }));
  } else {
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.levelId': levelId } });
  }
};

Template.levels.onCreated(function () {
  this.subscribe('levels');
  this.loading = new ReactiveVar(false);
  this.tab = new ReactiveVar(listMode);

  this.autorun(() => {
    const levels = Levels.find({ _id: { $ne: Meteor.settings.public.templateLevelId } }, { fields: { createdBy: 1 } }).fetch();
    const userIds = levels.map(level => level.createdBy).filter(Boolean);
    if (userIds?.length) this.subscribe('usernames', userIds);
  });
});

Template.levels.events({
  'click .js-create-level'() {
    Template.instance().loading.set(true);
    Meteor.call('createLevel', Meteor.settings.public.templateLevelId, (err, levelId) => {
      if (err) {
        Template.instance().loading.set(false);
        error(err);

        return;
      }

      // we need to wait collections update on the simulation part, todo: find a better way to handle that
      setTimeout(() => askLoadLevel(levelId), 500);
    });
  },
  'click .js-tab-switcher'(e) {
    const { mode } = e.target.dataset;
    Template.instance().tab.set(mode);
  },
  'click .js-level-select'(e) {
    Template.instance().loading.set(true);
    const { levelId } = e.target.dataset;
    askLoadLevel(levelId, true);
  },
});

Template.levels.helpers({
  isLevelOwner(level) { return Meteor.userId() === level.createdBy; },
  levels() {
    const levels = Levels.find({}, { sort: { visit: -1 } }).fetch();
    const userId = Meteor.userId();

    return levels.sort((a, b) => {
      if (a.createdBy === userId && b.createdBy !== userId) return -1;
      if (b.createdBy === userId && a.createdBy !== userId) return 1;

      return a.visit - b.visit;
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
});
