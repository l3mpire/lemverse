const sortFilters = { completed: 1, createdAt: -1 };

const closeInterface = () => Session.set('quests', undefined);

const showQuestsList = () => Session.get('quests') && Session.get('console');

const markQuestAsCompleted = questId => {
  if (!questId) throw new Error(`questId is missing`);
  Quests.update(questId, { $set: { completed: true } });
};

const selectQuest = (questId, template) => {
  template.selectedQuest.set(questId);
  messagesModule.changeMessagesChannel(questId);
};

const autoSelectQuest = template => {
  if (Session.get('quests')?.includes('qst_')) selectQuest(Session.get('quests'), template);
  else {
    const firstQuest = Quests.findOne({}, { sort: sortFilters, limit: 1 });
    if (firstQuest) selectQuest(firstQuest._id, template);
  }
};

Template.questsList.events({
  'click .js-quest'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    selectQuest(e.currentTarget.dataset.questId, template);
  },
  'click .js-mark-as-completed'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    markQuestAsCompleted(template.selectedQuest.get());
  },
});

Template.questsList.onCreated(function () {
  this.selectedQuest = new ReactiveVar(undefined);

  this.autorun(() => {
    if (!showQuestsList()) return;

    this.subscribe('quests', () => {
      const quests = Quests.find().fetch();
      const userIds = quests.map(quest => quest.createdBy).filter(Boolean);
      if (userIds?.length) this.subscribe('usernames', userIds);

      Tracker.nonreactive(() => autoSelectQuest(this));
    });
  });

  hotkeys('escape', scopes.player, () => closeInterface());
});

Template.questsList.helpers({
  show() { return showQuestsList(); },
  hasQuests() { return Quests.find().count(); },
  quests() { return Quests.find({}, { sort: sortFilters }).fetch(); },
  author(id) { return Meteor.users.findOne(id)?.profile.name || '[deleted]'; },
  isQuestSelected(id) { return Template.instance().selectedQuest.get() === id; },
  canMarkAsCompleted(userId) { return userId === Meteor.userId(); },
});
