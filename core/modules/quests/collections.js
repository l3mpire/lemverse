Quests = lp.collectionRegister('quests', 'qst', [], {
  insert() { return true; },
  update(userId, quest, fields) {
    if (quest.createdBy === userId) return true;

    if (fields.length === 1) {
      if (['completed', 'name'].includes(fields[0])) return quest.targets.includes(userId);
      if (fields[0] === 'targets') return true;
    }

    return false;
  },
  remove(userId, quest) { return quest.createdBy === userId; },
});
