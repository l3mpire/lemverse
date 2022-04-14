const modes = Object.freeze({
  mine: 'mine',
  completed: 'completed',
});

const onConsoleClosed = () => Session.set('quests', undefined);

const selectQuest = questId => {
  Session.set('selectedQuestId', questId);
  messagesModule.changeMessagesChannel(questId);
};

const quests = mode => {
  let filters = {};
  if (mode === modes.mine) {
    filters = {
      $or: [
        { createdBy: Meteor.userId() },
        { targets: Meteor.userId() },
        { targets: { $size: 0 } },
      ],
      completed: { $exists: false },
    };
  } else if (mode === modes.completed) {
    filters = {
      $or: [
        { targets: Meteor.userId() },
        { createdBy: Meteor.userId() },
      ],
      completed: true,
    };
  }

  const allQuests = Quests.find(filters, { sort: { createdAt: -1 } }).fetch();
  return _.groupBy(allQuests, qst => (qst.origin.includes('ent_') ? qst.origin : 'mine'));
};

const autoSelectQuest = template => {
  const selectedQuestId = Session.get('quests')?.selectedQuestId || '';
  if (selectedQuestId.includes('qst_')) selectQuest(selectedQuestId, template);
  else {
    const allQuests = quests(template.questListMode.get());
    const firstQuest = Object.keys(allQuests).length ? Object.values(allQuests)[0][0] : undefined;
    if (firstQuest) selectQuest(firstQuest._id, template);
    else {
      messagesModule.stopListeningMessagesChannel();
      Session.set('selectedQuestId', undefined);
    }
  }

  // auto switch quest-list mode
  if (selectedQuestId) {
    const quest = Quests.findOne(selectedQuestId);

    let mode = modes.mine;
    if (!quest) mode = modes.mine;
    else if (quest.completed) mode = modes.completed;
    else if (!quest.targets.length) mode = modes.mine;
    template.questListMode.set(mode);
  }
};

const draftQuestId = () => {
  const selectedQuestId = Session.get('quests')?.selectedQuestId;
  if (!selectedQuestId) return undefined;
  if (Quests.findOne(selectedQuestId)) return undefined;

  return selectedQuestId;
};

const beforeSendingMessage = e => {
  const { channel } = e.detail;
  if (!channel.includes('qst_') || !Session.get('quests')) return;

  const quest = Quests.findOne(channel);
  if (quest) return;
  const name = document.querySelector('.js-quest-name')?.value;

  Quests.insert({
    _id: channel,
    origin: Session.get('quests').origin,
    targets: Session.get('quests').targets || [],
    createdAt: new Date(),
    createdBy: Meteor.userId(),
    name,
  });
};

const entityName = (entityId, defaultName = 'Entity') => Entities.findOne(entityId)?.name || defaultName;

createQuestDraft = (targets, origin) => Session.set('quests', { selectedQuestId: Quests.id(), targets, origin });

Template.questsList.events({
  'click .js-quest'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    selectQuest(e.currentTarget.dataset.questId, template);
  },
  'click .js-quest-switch-mode'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    Session.set('quests', { origin: 'menu' });

    const { mode } = e.target.dataset;
    template.questListMode.set(modes[mode] || modes.mine);
    autoSelectQuest(template);
  },
});

Template.questsList.onCreated(function () {
  Session.set('quests', undefined);
  Session.set('selectedQuestId', undefined);
  this.questListMode = new ReactiveVar(modes.mine);
  this.userSubscribeHandler = undefined;
  this.questSubscribeHandler = undefined;

  this.autorun(() => {
    if (!Session.get('quests')) {
      this.userSubscribeHandler?.stop();
      this.questSubscribeHandler?.stop();
      Session.set('selectedQuestId', undefined);
      return;
    }

    Tracker.nonreactive(() => {
      openConsole();
      messagesModule.stopListeningMessagesChannel();

      this.questSubscribeHandler = this.subscribe('quests', () => {
        const userIds = Quests.find().fetch().flatMap(quest => [quest.createdBy, ...(quest.targets || [])]).filter(Boolean);
        if (userIds?.length) this.userSubscribeHandler = this.subscribe('usernames', [...new Set(userIds)]);

        autoSelectQuest(this);
      });
    });
  });

  window.addEventListener(eventTypes.consoleClosed, onConsoleClosed);
  window.addEventListener(eventTypes.beforeSendingMessage, beforeSendingMessage);
});

Template.questsList.onDestroyed(() => {
  Session.set('quests', undefined);
  window.removeEventListener(eventTypes.consoleClosed, onConsoleClosed);
  window.removeEventListener(eventTypes.beforeSendingMessage, beforeSendingMessage);
});

Template.questsList.helpers({
  show() { return Session.get('quests'); },
  questsCategorized() {
    const mode = Template.instance().questListMode.get();
    const categoryDefaultName = mode === modes.completed ? 'Done' : 'My quests';
    const questsArray = quests(mode);
    const categorizedQuests = Object.entries(questsArray).map(([key, value]) => ({ name: entityName(key, categoryDefaultName), count: value.length, quests: value, order: key === 'mine' ? -1 : 0 }));

    return categorizedQuests.sort((a, b) => a.order - b.order);
  },
  isActiveMode(mode) { return Template.instance().questListMode.get() === mode; },
  newQuest() {
    const questId = draftQuestId();
    if (!questId) return undefined;

    const { targets, origin } = Session.get('quests');
    if (!targets || targets.length === 0) return entityName(origin);

    if (!targets.length) return undefined;

    const userId = targets[0];
    if (!userId?.includes('usr_')) return undefined;

    return Meteor.users.findOne(userId)?.profile.name || 'New quest';
  },
  draftQuestId() { return draftQuestId(); },
  questListModeIsActive(mode) { return Template.instance().questListMode.get() === mode; },
  draftQuestSelected() { return Session.get('selectedQuestId') === draftQuestId(); },
});

Template.questListEntry.helpers({
  title() {
    if (this.name) return this.name;

    const fromEntity = this.origin.includes('ent_');
    if (this.createdBy !== Meteor.userId()) {
      if (fromEntity) return entityName(this.origin);
      else return Meteor.users.findOne(this.createdBy)?.profile.name || '[deleted]';
    }

    if (fromEntity) return `> ${entityName(this.origin)}`;
    else if (this.targets?.length === 1) return `> ${Meteor.users.findOne(this.targets[0])?.profile.name || '[deleted]'}`;
    else return `> ${this.targets.length} users`;
  },
  hasUpdates() {
    const notification = Notifications.findOne({ channelId: this._id });
    if (!notification) return false;

    return !notification.read;
  },
  selected() { return Session.get('selectedQuestId') === this._id; },
  user() {
    if (this.createdBy === Meteor.userId()) return Meteor.user();
    return Meteor.users.findOne(this.createdBy);
  },
});
