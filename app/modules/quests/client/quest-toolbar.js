const activeQuest = () => {
  const questId = Session.get('selectedQuest');
  if (!questId) return undefined;

  return Quests.findOne(questId);
};

const updateTitle = title => {
  const questId = Session.get('selectedQuest');
  if (!questId) return;

  if (!title?.length) Quests.update(questId, { $unset: { name: 1 } });
  else Quests.update(questId, { $set: { name: title } });
};

const questUserIds = () => {
  const quest = activeQuest();
  if (!quest) return [];

  const userIds = quest.targets || [];
  userIds.push(quest.createdBy);

  return userIds;
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
});

Template.questToolbar.onCreated(() => {

});

Template.questToolbar.helpers({
  show() { return Session.get('selectedQuest'); },
  title() { return activeQuest()?.name || 'Messages'; },
  userAmount() { return questUserIds().length; },
  users() { return questUserIds().map(userId => Meteor.users.findOne(userId)); },
});
