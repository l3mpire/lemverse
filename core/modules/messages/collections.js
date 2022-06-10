messageModerationAllowed = (userId, message) => {
  if (!userId || !message) return false;
  if (message.createdBy === userId) return true;

  return isEditionAllowed(userId);
};

Messages = lp.collectionRegister('messages', 'msg', [], {
  insert() { return true; }, // todo: check zone permissions using channelId and/or targeted users
  update() { return false; }, // not used for now
  remove(userId, message) { return messageModerationAllowed(userId, message); },
});
