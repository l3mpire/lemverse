import { canAccessZone, canModerateUser, currentLevel } from '../../lib/misc';

const permissionType = 'useMessaging';

const zoneMessagingAllowed = (zone, user) => {
  if (!canAccessZone(zone, user)) return false;
  if (!zone.messagingRestrictedToGuild) return true;

  const level = currentLevel(user);
  if (!level) throw new Meteor.Error('not-found', 'Level not found');
  if (!level.guildId) throw new Meteor.Error('configuration-missing', 'Guild not linked to the level. You must link a guild to the level or remove the "messagingRestrictedToGuild" attribute');

  return level.guildId === user.guildId;
};

const messagingAllowed = (channel, userId) => {
  check(channel, String);
  check(userId, Match.Id);

  if (channel.includes('usr_')) return channel.split(';').includes(userId);

  check(channel, Match.Id);
  if (channel.includes('zon_')) return zoneMessagingAllowed(Zones.findOne(channel), Meteor.users.findOne(userId));
  if (channel.includes('qst_')) return canAccessQuest && canAccessQuest(channel, userId);
  if (channel.includes('lvl_')) return Meteor.users.findOne(userId)?.profile.levelId === channel;

  return false;
};

const messageModerationAllowed = (user, message) => {
  check([user._id, message._id], [Match.Id]);

  if (message.createdBy === user._id) return true;

  const userOwningMessage = Meteor.users.findOne(message.createdBy);
  if (!userOwningMessage) return false;

  return canModerateUser(user, userOwningMessage);
};

export {
  messagingAllowed,
  messageModerationAllowed,
  permissionType,
};
