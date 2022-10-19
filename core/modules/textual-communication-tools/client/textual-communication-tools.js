import audioManager from '../../../client/audio-manager';
import { guestAllowed } from '../../../lib/misc';
import { moduleType } from '../../../client/helpers';

const permissionType = 'useMessaging';

window.addEventListener('load', () => {
  registerModules(['textualCommunicationTools'], moduleType.GAME);
  registerModules(['userListMessageButton'], moduleType.USER_LIST);

  registerModules(
    [
      { id: 'send-text', icon: '💬', shortcut: 56, order: 41, label: 'Text', closeMenu: true, scope: 'other' },
      { id: 'open-console', icon: '💬', shortcut: 56, order: 41, label: 'Text', closeMenu: true, scope: 'me' },
    ],
    moduleType.RADIAL_MENU,
  );

  Tracker.autorun(() => {
    const user = Meteor.user({ fields: { guildId: 1 } });
    if (!user || !user.guildId) return;

    Tracker.nonreactive(() => {
      registerModules(
        [
          { id: 'new-quest', icon: '📜', shortcut: 53, label: 'New task', closeMenu: true, scope: 'other' },
          { id: 'show-quests', icon: '📜', shortcut: 57, order: 42, label: 'Tasks', closeMenu: true, scope: 'me' },
        ],
        moduleType.RADIAL_MENU,
      );

      registerModules(['userListQuestButton'], moduleType.USER_LIST);
    });
  });
});

const openMessagingInterface = channel => {
  closeModal();
  messagesModule.changeMessagesChannel(channel);
  openConsole();
};

const onNotificationReceived = async e => {
  if (Meteor.settings.public.features?.notificationButton?.enabled === false) return;
  const { notification } = e.detail;

  if (!notification.channelId?.includes('qst_')) return;

  let message;
  if (notification.type === 'quest-new') message = `📜 A new task is available!`;
  else if (notification.type === 'quest-updated') message = `📜 A task has been updated`;

  const notificationInstance = await notify(Meteor.users.findOne(notification.createdBy), message);
  if (!notificationInstance) {
    if (notification.type === 'quest-new') audioManager.play('trumpet-fanfare.mp3', 0.25);
    else audioManager.play('text-sound.wav', 0.5);

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
  } else if (!this.fileId) openMessagingInterface(questId);
};

const onMenuOptionSelected = e => {
  const { option, user } = e.detail;

  if (option.id === 'show-quests') Session.set('quests', { origin: 'menu' });
  else if (option.id === 'open-console') openConsole(true);
  else if (option.id === 'send-text') {
    const channel = [user._id, Meteor.userId()].sort().join(';');
    openMessagingInterface(channel);
  } else if (option.id === 'new-quest' && user) createQuestDraft([user._id], Meteor.userId());
};

const onPeerDataReceived = e => {
  const { data, meta } = e.detail;
  if (data.type !== 'text') return;
  if (!meta['pop-in']) return;

  meta['pop-in'].on('click', () => {
    if (!data.data.channel) return;
    openMessagingInterface(data.data.channel);
  });
};

Template.textualCommunicationTools.onCreated(() => {
  messagesModule.init();
  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onNotificationClicked, onNotificationClicked);
  window.addEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
  window.addEventListener(eventTypes.onPeerDataReceived, onPeerDataReceived);
});

Template.textualCommunicationTools.onDestroyed(() => {
  window.removeEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.removeEventListener(eventTypes.onNotificationClicked, onNotificationClicked);
  window.removeEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
  window.removeEventListener(eventTypes.onPeerDataReceived, onPeerDataReceived);
});

Template.textualCommunicationTools.helpers({
  show: () => Session.get('console'),
  canUseModule: () => {
    const guest = Meteor.user({ fields: { 'profile.guest': 1 } })?.profile.guest;
    if (guest) return guestAllowed(permissionType);

    return true;
  },
  useGenericChat: () => (Meteor.settings.public.features?.useMessaging?.enabled !== false),
});
