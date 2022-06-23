const messagingAllowed = (channel, userId) => {
  check(channel, String);
  check(userId, Match.Id);

  if (channel.includes('usr_')) return channel.split(';').includes(userId);

  if (channel.includes('zon_')) {
    check(channel, Match.Id);
    return canAccessZone(channel, userId);
  }

  if (channel.includes('qst_')) {
    check(channel, Match.Id);
    return canAccessQuest && canAccessQuest(channel, userId);
  }

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
