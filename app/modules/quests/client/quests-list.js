const sortFilters = { completed: 1, createdAt: -1 };

const closeInterface = () => Session.set('quests', undefined);

const onKeyPressed = e => {
  if (e.key === 'Escape') closeInterface();
};

const toggleQuestState = questId => {
  if (!questId) throw new Error(`questId is missing`);

  const newQuestState = !Quests.findOne(questId).completed;
  Quests.update(questId, { $set: { completed: newQuestState } });

  const message = `${!newQuestState ? 'reopened' : 'closed'} the quest`;
  messagesModule.sendMessage(questId, message);
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
  'click .js-toggle-state'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    toggleQuestState(template.selectedQuest.get());
  },
});

Template.questsList.onCreated(function () {
  Session.set('quests', undefined);
  this.selectedQuest = new ReactiveVar(undefined);

  this.autorun(() => {
    if (!Session.get('quests')) return;

    Tracker.nonreactive(() => {
      Session.set('console', true);
      this.subscribe('quests', () => {
        const quests = Quests.find().fetch();
        const userIds = quests.map(quest => quest.createdBy).filter(Boolean);
        if (userIds?.length) this.subscribe('usernames', userIds);

        autoSelectQuest(this);
      });
    });
  });

  document.addEventListener('keydown', onKeyPressed);
});

Template.questsList.onDestroyed(() => {
  Session.set('quests', undefined);
  document.removeEventListener('keydown', onKeyPressed);
});

Template.questsList.helpers({
  show() { return Session.get('quests'); },
  hasQuests() { return Quests.find().count(); },
  quests() { return Quests.find({}, { sort: sortFilters }).fetch(); },
  author(id) { return Meteor.users.findOne(id)?.profile.name || '[deleted]'; },
  isQuestSelected(id) { return Template.instance().selectedQuest.get() === id; },
});
