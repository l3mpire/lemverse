const activeQuest = () => {
  const questId = Session.get('selectedQuestId');
  if (!questId) return undefined;

  return Quests.findOne(questId);
};

const updateTitle = title => {
  const questId = Session.get('selectedQuestId');
  if (!questId) return;

  if (!title?.length) Quests.update(questId, { $unset: { name: 1 } });
  else Quests.update(questId, { $set: { name: title } });
};

const joinQuest = () => {
  const questId = Session.get('selectedQuestId');
  if (!questId) return;

  Quests.update(questId, { $addToSet: { targets: Meteor.userId() } }, error => {
    if (error) { lp.notif.error(`Unable to join the quest`); return; }

    const message = `${Meteor.user().profile.name} has joined the quest`;
    messagesModule.sendMessage(questId, message);
  });
};

const toggleQuestState = () => {
  const quest = activeQuest();
  if (!quest) return;

  const { completed } = quest;
  const actions = completed ? { $unset: { completed: 1 } } : { $set: { completed: true } };
  Quests.update(quest._id, actions, error => {
    if (error) { lp.notif.error(`Unable to update the quest`); return; }

    const message = `has ${completed ? 'reopened' : 'completed'} the quest`;
    messagesModule.sendMessage(quest._id, message);
  });
};

Template.questToolbar.events({
  'focus .js-quest-name'(e) {
    e.preventDefault();
    e.stopPropagation();
    hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false);
  },
  'blur .js-quest-name'(e) {
    e.preventDefault();
    e.stopPropagation();
    hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false);
    updateTitle(e.currentTarget.value);
  },
  'click .js-quest-join'(e) {
    e.preventDefault();
    e.stopPropagation();
    joinQuest();
  },
  'click .js-toggle-state'(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleQuestState();
  },
});

Template.questToolbar.onCreated(function () {
  this.users = new ReactiveVar([]);

  this.autorun(() => {
    const quest = activeQuest();
    if (!quest) return;

    Meteor.call('questUsers', quest._id, (error, users) => {
      if (error) { lp.notif.error(`An error occured while loading quest users`); return; }
      this.users.set(users);
    });
  });
});

Template.questToolbar.helpers({
  show() { return Session.get('selectedQuestId'); },
  title() { return activeQuest()?.name; },
  users() { return Template.instance().users.get(); },
  completed() { return activeQuest()?.completed; },
  createdBy(user) { return activeQuest()?.createdBy === user._id; },
  showJoinButton() {
    const quest = activeQuest();
    if (!quest) return false;

    return quest.origin.includes('ent_') && !quest.targets.includes(Meteor.userId()) && quest.createdBy !== Meteor.userId();
  },
});
