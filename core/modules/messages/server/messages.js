import { messagingAllowed } from '../misc';
import { getChannelType, subscribedUsersToEntity } from '../../../lib/misc';

const limit = 20;

// todo: remove the old "questId" attribute from notifications (the new field is "channelId") + simplify notifications queries
const removePreviousNotifications = ({ channel, createdBy }) => {
  Notifications.remove({ $or: [{ questId: channel }, { channelId: channel }], userId: { $ne: createdBy } });
};

const notifyQuestSubscribersAboutNewMessage = (questId, message) => {
  log('notifyQuestSubscribersAboutNewMessage: start', { questId, message });
  const quest = Quests.findOne(questId);
  if (!quest) {
    log('Invalid quest id', { questId, message });
    return;
  }

  const targets = (quest.targets || []);

  // When someone has joined the quest we stop sending notifications to all subscribed users
  const subscribedUsers = targets.length > 0 ? [] : subscribedUsersToEntity(quest.origin).map(u => u._id);
  targets.push(quest.createdBy);

  const usersToNotify = [...new Set([...subscribedUsers, ...targets])].filter(userId => userId !== message.createdBy);
  if (!usersToNotify.length) {
    log('notifyQuestSubscribersAboutNewMessage: no subscribed users or targets');
    return;
  }

  removePreviousNotifications(message);

  const questMessageCount = Messages.find({ channel: questId }).count();
  const type = questMessageCount > 1 ? 'quest-updated' : 'quest-new';

  const notifications = usersToNotify.map(userId => ({
    _id: Notifications.id(),
    channelId: questId,
    userId,
    createdAt: new Date(),
    createdBy: message.createdBy,
    type,
  }));

  Notifications.rawCollection().insertMany(notifications);
  log('notifyQuestSubscribersAboutNewMessage: done', { amount: usersToNotify.length });
};

const setCollectionLastMessageAtToNow = (collection, documentId) => collection.update(documentId, { $set: { lastMessageAt: new Date() } });

const notifyUsers = message => {
  const { channel, createdBy } = message;

  log('notifyUsers: start', { channel });
  removePreviousNotifications(message);

  let userIds = [];

  if (getChannelType(channel) === 'level') {
    userIds = Meteor.users.find({ _id: { $ne: createdBy }, 'status.online': true, 'profile.levelId': channel }, { fields: { 'profile._id': 1 } }).fetch().map(item => item._id);
  } else userIds = channel.split(';').filter(userId => userId !== createdBy);

  if (userIds.length) {
    const notifications = userIds.map(userId => ({
      _id: Notifications.id(),
      channelId: channel,
      userId,
      createdAt: new Date(),
      createdBy,
    }));
    Promise.await(Notifications.rawCollection().insertMany(notifications));
  }

  log('notifyUsers: done', { userIds });
};

Meteor.startup(() => {
  Messages.find({ createdAt: { $gte: new Date() } }).observe({
    added(message) {
      const channelType = getChannelType(message.channel);

      if (channelType === 'quest') notifyQuestSubscribersAboutNewMessage(message.channel, message);
      else if (channelType === 'zone') setCollectionLastMessageAtToNow(Zones, message.channel);
      else if (channelType === 'discussion') notifyUsers(message);
      else if (channelType === 'level') {
        setCollectionLastMessageAtToNow(Levels, message.channel);
        notifyUsers(message);
      }
    },
  });
});

Meteor.publish('messages', function (channel) {
  check(channel, String);
  if (!this.userId) return undefined;
  if (!messagingAllowed(channel, this.userId)) throw new Meteor.Error('not-authorized', 'Access not allowed');

  return Messages.find({ channel }, { sort: { createdAt: -1 }, limit });
});

Meteor.methods({
  clearConferenceMessages(conferenceUUID) {
    if (!this.userId) return;

    log('clearConferenceMessages: start', { conferenceUUID, userId: this.userId });
    check(conferenceUUID, String);

    const user = Meteor.user();
    const zone = Zones.findOne({ uuid: conferenceUUID, levelId: user.profile.levelId });
    if (!zone) throw new Meteor.Error('not-found', 'Zone not found');
    if (!zone.roomName) throw new Meteor.Error('invalid-zone', 'Zone invalid (not a conference zone)');
    if (!zone.uuid) throw new Meteor.Error('invalid-zone', 'Zone without uuid (Conference room not initialized)');

    Messages.remove({ channel: zone._id });

    log('clearConferenceMessages: done', { zoneId: zone._id, conferenceUUID, userId: this.userId });
  },
  sendMessage(channel, text, fileId) {
    if (!this.userId) return undefined;

    log('sendMessage: start', { channel, text, fileId, userId: this.userId });
    check([channel, text], [String]);
    check(fileId, Match.Maybe(String));

    if (!messagingAllowed(channel, this.userId)) throw new Meteor.Error('not-authorized', 'Not allowed');

    const messageId = Messages.id();
    Messages.insert({
      _id: messageId,
      channel,
      text,
      fileId,
      createdAt: new Date(),
      createdBy: this.userId,
    });

    analytics.track(this.userId, '✍️ Message Sent', { user_id: this.userId, context: getChannelType(channel) });
    log('sendMessage: done', { messageId });

    return messageId;
  },
  toggleMessageReaction(messageId, reaction) {
    if (!this.userId) return;

    check(messageId, Match.Id);
    check(reaction, String);

    let message = Messages.findOne(messageId);
    if (!message) throw new Meteor.Error('not-found', 'Not found');

    if (!message.reactions || !message.reactions[reaction]?.includes(this.userId)) {
      Messages.update(messageId, { $addToSet: { [`reactions.${reaction}`]: this.userId } });
    } else {
      Messages.update(messageId, { $pull: { [`reactions.${reaction}`]: this.userId } });
    }

    message = Messages.findOne(messageId);
    if (message.reactions[reaction].length === 0) Messages.update(messageId, { $unset: { [`reactions.${reaction}`]: 1 } });
  },
  messagesUpdateChannelLastSeenDate(channelId, create = false) {
    if (!this.userId) return;
    check(channelId, Match.Id);
    check(create, Boolean);

    const { zoneLastSeenDates } = Meteor.user();
    if (create || (zoneLastSeenDates && zoneLastSeenDates[channelId])) {
      Meteor.users.update(this.userId, {
        $set: {
          [`zoneLastSeenDates.${channelId}`]: new Date(),
        },
      });
    }
  },
  messagesUnsubscribeFromChannelNotifications(channelId) {
    if (!this.userId) return;
    check(channelId, Match.Id);

    Meteor.users.update(this.userId, {
      $unset: {
        [`zoneLastSeenDates.${channelId}`]: 1,
      },
    });
  },
});
