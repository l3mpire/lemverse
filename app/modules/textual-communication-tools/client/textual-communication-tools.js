window.addEventListener('load', () => {
  registerModules(['textualCommunicationTools']);
  registerUserListModules(['userListMessageButton']);

  registerRadialMenuModules([
    { id: 'send-text', icon: '💬', shortcut: 56, order: 41, label: 'Text', closeMenu: true, scope: 'other' },
    { id: 'open-console', icon: '💬', shortcut: 56, order: 41, label: 'Text', closeMenu: true, scope: 'me' },
  ]);

  Tracker.autorun(() => {
    const user = Meteor.user({ fields: { guildId: 1 } });
    if (!user || !user.guildId) return;

    Tracker.nonreactive(() => {
      registerRadialMenuModules([
        { id: 'new-quest', icon: '📜', shortcut: 53, label: 'New quest', closeMenu: true, scope: 'other' },
        { id: 'show-quests', icon: '📜', shortcut: 57, order: 42, label: 'Quests', closeMenu: true, scope: 'me' },
      ]);

      registerUserListModules(['userListQuestButton']);
    });
  });
});

const onNotificationReceived = async e => {
  const { notification } = e.detail;
  if (!notification.channelId.includes('qst_')) return;

  let message;
  if (notification.type === 'quest-new') message = `📜 A new quest is available!`;
  else if (notification.type === 'quest-updated') message = `📜 A quest has been updated`;

  const notificationInstance = await notify(Meteor.users.findOne(notification.createdBy), message);
  if (!notificationInstance) {
    if (notification.type === 'quest-new') sounds.play('trumpet-fanfare.mp3', 0.25);
    else sounds.play('text-sound.wav', 0.5);

    return;
  }

  notificationInstance.onclick = () => {
    e.preventDefault();
    Session.set('quests', { selectedQuestId: notification.questId, origin: 'notifications' });
  };
};

const onNotificationClicked = e => {
  const { notification } = e.detail;

  const questId = notification.questId || notification.channelId;
  const questNotification = questId?.includes('qst_');

  if (questNotification) {
    closeModal();
    Session.set('quests', { selectedQuestId: questId, origin: 'notifications' });
  } else if (!this.fileId) {
    closeModal();
    messagesModule.changeMessagesChannel(questId);
    openConsole();
  }
};

const onMenuOptionSelected = e => {
  const { option, user } = e.detail;

  if (option.id === 'show-quests') Session.set('quests', { origin: 'menu' });
  else if (option.id === 'open-console') openConsole(true);
  else if (option.id === 'send-text') {
    const channel = [user._id, Meteor.userId()].sort().join(';');
    messagesModule.changeMessagesChannel(channel);
    openConsole();
  } else if (option.id === 'new-quest' && user) createQuestDraft([user._id], Meteor.userId());
};

Template.textualCommunicationTools.onCreated(() => {
  messagesModule.init();
  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onNotificationClicked, onNotificationClicked);
  window.addEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
});

Template.textualCommunicationTools.onDestroyed(() => {
  window.removeEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.removeEventListener(eventTypes.onNotificationClicked, onNotificationClicked);
  window.removeEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
});

Template.textualCommunicationTools.helpers({
  guest: () => Meteor.user()?.profile.guest,
  show: () => Session.get('console'),
});
