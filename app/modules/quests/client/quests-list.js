const showQuestsList = () => Session.get('quests') && Session.get('console');

Template.questsList.events({
  'click .js-quest'(e) {
    e.preventDefault();
    e.stopPropagation();

    const { questId } = e.currentTarget.dataset;
    messagesModule.changeMessagesChannel(questId);
  },
});

Template.questsList.onCreated(function () {
  this.autorun(() => {
    if (!showQuestsList()) return;

    this.subscribe('quests');
  });
});

Template.questsList.helpers({
  show() { return showQuestsList(); },
  hasQuests() { return Quests.find().count(); },
  quests() { return Quests.find().fetch(); },
});
