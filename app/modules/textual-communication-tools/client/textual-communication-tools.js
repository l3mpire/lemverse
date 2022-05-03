window.addEventListener('load', () => registerModule('textualCommunicationTools'));

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

Template.textualCommunicationTools.onCreated(() => {
  messagesModule.init();
  window.addEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
});

Template.textualCommunicationTools.onDestroyed(() => {
  window.removeEventListener(eventTypes.onNotificationReceived, onNotificationReceived);
});

Template.textualCommunicationTools.helpers({
  guest: () => Meteor.user()?.profile.guest,
  show: () => Session.get('console'),
});
