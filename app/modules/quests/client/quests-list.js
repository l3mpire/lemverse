const modes = Object.freeze({
  mine: 'mine',
  entity: 'entity',
});

const closeInterface = () => Session.set('quests', undefined);

const onKeyPressed = e => {
  if (e.key === 'Escape') closeInterface();
};

const toggleQuestMode = template => {
  const mode = template.questListMode.get();
  template.questListMode.set(mode === modes.entity ? modes.mine : modes.entity);
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
  Session.set('console', true);

  // mark linked notification as read
  const notification = Notifications.findOne({ questId, userId: Meteor.userId() });
  if (notification && !notification.read) Notifications.update(notification._id, { $set: { read: true } });
};

const quests = mode => {
  const filters = mode === modes.mine ? {
    $or: [
      { targets: Meteor.userId() },
      { createdBy: Meteor.userId() },
    ],
  } : { origin: { $regex: /^ent_/ } };

  return Quests.find(filters, { sort: { completed: 1, createdAt: -1 } }).fetch();
};

const autoSelectQuest = template => {
  const questId = Session.get('quests')?.questId || '';
  if (questId.includes('qst_')) selectQuest(questId, template);
  else {
    const allQuests = quests(template.questListMode.get());
    const firstQuest = allQuests.length ? allQuests[0] : undefined;
    if (firstQuest) selectQuest(firstQuest._id, template);
  }

  // auto switch quest-list mode
  if (questId) {
    const quest = Quests.findOne(questId);
    const origin = quest?.origin || Session.get('quests')?.origin || '';
    template.questListMode.set(!origin.includes('ent_') ? modes.mine : modes.entity);
  }
};

const draftQuestId = () => {
  const questId = Session.get('quests')?.questId;
  if (!questId) return undefined;

  const isNewQuest = !Quests.findOne(questId);
  if (!isNewQuest) return undefined;

  return questId;
};

const beforeSendingMessage = e => {
  const { channel } = e.detail;
  if (!channel.includes('qst_')) return;

  const quest = Quests.findOne(channel);
  if (quest) return;

  Quests.insert({
    _id: channel,
    origin: Session.get('quests').origin,
    targets: Session.get('quests').targets || [],
    createdAt: new Date(),
    createdBy: Meteor.userId(),
  });
};

const entityName = entityId => Entities.findOne(entityId)?.name || 'Entity';

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
  'click .js-quest-switch'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    Session.set('quests', { origin: 'menu' });
    toggleQuestMode(template);
    autoSelectQuest(template);
  },
});

Template.questsList.onCreated(function () {
  Session.set('quests', undefined);
  this.selectedQuest = new ReactiveVar(undefined);
  this.questListMode = new ReactiveVar(modes.mine);
  this.userSubscribeHandler = undefined;
  this.questSubscribeHandler = undefined;

  this.autorun(() => {
    if (!Session.get('quests')) {
      this.userSubscribeHandler?.stop();
      this.questSubscribeHandler?.stop();
      return;
    }

    Tracker.nonreactive(() => {
      this.questSubscribeHandler = this.subscribe('quests', () => {
        const userIds = Quests.find().fetch().flatMap(quest => [quest.createdBy, ...(quest.targets || [])]).filter(Boolean);
        if (userIds?.length) this.userSubscribeHandler = this.subscribe('usernames', [...new Set(userIds)]);

        autoSelectQuest(this);
      });
    });
  });

  document.addEventListener('keydown', onKeyPressed);
  window.addEventListener(eventTypes.beforeSendingMessage, beforeSendingMessage);
});

Template.questsList.onDestroyed(() => {
  Session.set('quests', undefined);
  document.removeEventListener('keydown', onKeyPressed);
  window.removeEventListener(eventTypes.beforeSendingMessage, beforeSendingMessage);
});

Template.questsList.helpers({
  show() { return Session.get('quests'); },
  quests() { return quests(Template.instance().questListMode.get()); },
  title(quest) {
    const isEntityOrigin = quest.origin.includes('ent_');
    if (quest.createdBy !== Meteor.userId()) {
      if (isEntityOrigin) return entityName(quest.origin);
      else return Meteor.users.findOne(quest.createdBy)?.profile.name || '[deleted]';
    }

    if (isEntityOrigin) return `> ${entityName(quest.origin)}`;
    else if (quest.targets?.length === 1) return `> ${Meteor.users.findOne(quest.targets[0])?.profile.name || '[deleted]'}`;
    else return `> ${quest.targets.length} users`;
  },
  hasUpdates(id) {
    const notification = Notifications.findOne({ questId: id });
    if (!notification) return false;

    return !notification.read;
  },
  isQuestSelected(id) { return Template.instance().selectedQuest.get() === id; },
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
  entityQuestMode() { return Template.instance().questListMode.get() === modes.entity; },
});
