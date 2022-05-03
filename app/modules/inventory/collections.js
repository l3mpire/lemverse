Items = lp.collectionRegister('items', 'itm', [], {
  insert(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  update(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
  remove(userId) { return Meteor.users.findOne(userId)?.roles?.admin; },
});
