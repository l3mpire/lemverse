import { currentLevel } from '../../lib/misc';

const zoneMessagingAllowed = (zoneId, userId) => {
  if (!canAccessZone(zoneId, userId)) return false;

  const zone = Zones.findOne(zoneId);
  if (!zone.messagingRestrictedToGuild) return true;

  const level = currentLevel(Meteor.users.findOne(userId));
  if (!level) throw new Meteor.Error('not-found', 'Level not found');
  if (!level.guildId) throw new Meteor.Error('configuration-missing', 'Guild not linked to the level. You must link a guild to the level or remove the "messagingRestrictedToGuild" attribute');

  return level.guildId === Meteor.users.findOne(userId).guildId;
};

const messagingAllowed = (channel, userId) => {
  check(channel, String);
  check(userId, Match.Id);

  if (channel.includes('usr_')) return channel.split(';').includes(userId);

  check(channel, Match.Id);
  if (channel.includes('zon_')) return zoneMessagingAllowed(channel, userId);
  if (channel.includes('qst_')) return canAccessQuest && canAccessQuest(channel, userId);
  if (channel.includes('lvl_')) return Meteor.users.findOne(userId)?.profile.levelId === channel;

  return false;
};

const messageModerationAllowed = (userId, message) => {
  if (!userId || !message) return false;
  if (message.createdBy === userId) return true;

  return isEditionAllowed(userId);
};

export {
  messagingAllowed,
  messageModerationAllowed,
};
