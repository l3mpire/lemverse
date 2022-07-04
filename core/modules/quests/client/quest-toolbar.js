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

  const userId = Meteor.userId();
  Quests.update(questId, { $addToSet: { targets: userId } }, error => {
    if (error) { lp.notif.error(`Unable to join the task`); return; }

    const message = `{{${userId}}} has joined the task`;
    messagesModule.sendMessage(questId, message);
  });
};

const leaveQuest = () => {
  const questId = Session.get('selectedQuestId');
  if (!questId) return;

  const userId = Meteor.userId();
  Quests.update(questId, { $pull: { targets: userId } }, error => {
    if (error) { lp.notif.error(`Unable to leave the task`); return; }

    const message = `{{${userId}}} left the task`;
    messagesModule.sendMessage(questId, message);
  });
};

const toggleQuestState = () => {
  const quest = activeQuest();
  if (!quest) return;

  const { completed } = quest;
  const actions = completed ? { $unset: { completed: 1 } } : { $set: { completed: true } };
  Quests.update(quest._id, actions, error => {
    if (error) { lp.notif.error(`Unable to update the task`); return; }

    const message = `has ${completed ? 'reopened' : 'completed'} the task`;
    messagesModule.sendMessage(quest._id, message);
  });
};

const setTargets = targets => {
  if (!targets.length) return;

  const questId = Session.get('selectedQuestId');
  if (!questId) return;

  Quests.update(questId, { $set: { targets } });
};

const showActionsButton = () => {
  const quest = activeQuest();
  if (!quest) return false;

  return quest.targets.includes(Meteor.userId()) || quest.createdBy === Meteor.userId();
};

const createNewQuestFromTitle = name => {
  if (!name?.length) return;

  const channel = Session.get('messagesChannel');

  const quest = Quests.findOne(channel);
  if (quest) { Quests.update(channel, { $set: { name } }); return; }

  Quests.insert({
    _id: channel,
    origin: Session.get('quests').origin,
    targets: Session.get('quests').targets || [],
    createdAt: new Date(),
    createdBy: Meteor.userId(),
    name,
  });

  const text = '<i>Everything is in the title ⬆</i>';
  messagesModule.sendMessage(channel, text);
};

Template.questToolbar.events({
  'keypress input.js-quest-name'(event) {
    if (event.which !== 13) return;
    createNewQuestFromTitle(event.currentTarget.value);
  },
  'focus .js-quest-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false);
  },
  'blur .js-quest-name'(event) {
    event.preventDefault();
    event.stopPropagation();
    hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false);
    updateTitle(event.currentTarget.value);
  },
  'click .js-quest-join'(event) {
    event.preventDefault();
    event.stopPropagation();
    joinQuest();
  },
  'click .js-quest-leave'(event) {
    event.preventDefault();
    event.stopPropagation();
    leaveQuest();
  },
  'click .js-quest-invite'(event, templateInstance) {
    event.preventDefault();
    event.stopPropagation();

    const quest = activeQuest();
    Session.set('modal', { template: 'userListSelection', selectedUsers: quest.targets, ignoredUsers: [quest.createdBy] });

    // we can't send callback to Session.set, so:
    // open the user selection modal then wait for the close action to add the selected users to the quest
    templateInstance.autorun(computation => {
      if (Session.get('modal')) return;
      computation.stop();

      Tracker.nonreactive(() => setTargets(Session.get('usersSelected') || []));
    });
  },
  'click .js-toggle-state'(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleQuestState();
  },
});

Template.questToolbar.onCreated(function () {
  this.users = new ReactiveVar([]);

  this.autorun(() => {
    const quest = activeQuest();
    if (!quest) return;

    Meteor.call('questUsers', quest._id, (error, users) => {
      if (error) { lp.notif.error(`An error occured while loading tasks`); return; }
      this.users.set(users);
    });
  });
});

Template.questToolbar.helpers({
  show() { return Session.get('selectedQuestId'); },
  title() { return activeQuest()?.name; },
  users() { return Template.instance().users.get(); },
  showActions() { return !!activeQuest(); },
  completed() { return activeQuest()?.completed; },
  createdBy(user) { return activeQuest()?.createdBy === user._id; },
  showJoinButton() {
    const quest = activeQuest();
    if (!quest) return false;

    return quest.origin.includes('ent_') && !quest.targets.includes(Meteor.userId()) && quest.createdBy !== Meteor.userId();
  },
  showLeaveButton() {
    const quest = activeQuest();
    if (!quest) return false;

    return quest.origin.includes('ent_') && quest.targets.includes(Meteor.userId()) && quest.createdBy !== Meteor.userId();
  },
  showInviteButton() { return showActionsButton() && !activeQuest()?.completed; },
  showActionsButton() { return showActionsButton(); },
});
