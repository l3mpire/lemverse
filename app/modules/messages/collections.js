Messages = lp.collectionRegister('messages', 'msg', [], {
  insert(userId) { return communicationAllowed(userId); },
  update(userId) { return communicationAllowed(userId); },
  remove(userId, message) { return messageModerationAllowed(userId, message); },
});
