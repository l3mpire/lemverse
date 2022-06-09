canAccessQuest = (questId, userId) => {
  check([questId, userId], [Match.Id]);

  const quest = Quests.findOne(questId);
  if (!quest) throw new Meteor.Error('not-found', 'Quest not found');

  const user = Meteor.users.findOne(userId);
  if (!user) throw new Meteor.Error('not-found', 'User not found');

  if (quest.origin === userId || quest.createdBy === userId) return true;
  if (quest.targets.includes(userId)) return true;
  if (quest.origin.includes('ent_')) return user.entitySubscriptionIds?.includes(quest.origin);

  return false;
};
