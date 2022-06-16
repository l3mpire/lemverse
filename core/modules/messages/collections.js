Messages = lp.collectionRegister('messages', 'msg', [], {
  insert() { return false; },
  update() { return false; },
  remove(userId, message) { return messageModerationAllowed(userId, message); },
});
