const messagingAllowed = (channel, userId) => {
  check(channel, String);
  check(userId, Match.Id);

  if (channel.includes('usr_')) return channel.split(';').includes(userId);

  check(channel, Match.Id);
  if (channel.includes('zon_')) return canAccessZone(channel, userId);
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
