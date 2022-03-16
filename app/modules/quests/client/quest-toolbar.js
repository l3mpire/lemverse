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

  Quests.update(questId, { $addToSet: { targets: Meteor.userId() } });
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
});

Template.questToolbar.onCreated(function () {
  this.users = new ReactiveVar([]);

  this.autorun(() => {
    const questId = Session.get('selectedQuestId');
    if (!questId) return;

    Meteor.call('questUsers', questId, (error, users) => {
      if (error) { lp.notif.error(`An error occured while loading quest users`); return; }
      this.users.set(users);
    });
  });
});

Template.questToolbar.helpers({
  show() { return Session.get('selectedQuestId'); },
  title() { return activeQuest()?.name || 'Messages'; },
  users() { return Template.instance().users.get(); },
  showJoinButton() {
    const quest = activeQuest();
    if (!quest) return false;

    return quest.origin.includes('ent_') && !quest.targets.includes(Meteor.userId());
  },
});
