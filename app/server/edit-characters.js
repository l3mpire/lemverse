Meteor.methods({
  updateUsersCharacter(from, to, id) {
    const user = Meteor.user();
    log('updateUsersCharacter: start', { from, to, id, userId: user._id });

    const characterPart = Characters.findOne({_id: id});
    if (!characterPart) {
      error('updateUsersCharacter: Invalid character part', {from, to, id, userId: user._id})
      throw new Meteor.Error('invalid-character-part', 'Trying to set an invalid part')
    }

    Characters.update(id, { $set: { category : to} });
    Meteor.users.update(
      { [`profile.${from}`]: id },
      {
        $unset: { [`profile.${from}`]: 1 },
        $set: { [`profile.${to}`]: id },
      },
      { multi: true },
    );
    return true;
  },
});
