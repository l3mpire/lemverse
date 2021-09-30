Meteor.methods({
  updateUsersCharacter(from, to, id) {
    const user = Meteor.user();
    log('updateUsersCharacter: start', { from, to, id, userId: user._id });

    if (!lp.isGod()) {
      error('updateUsersCharacter: user not allowed');
      throw new Meteor.Error('not-authorized', 'only gods can do this');
    }
    check([to, id], [String]);

    const characterPart = Characters.findOne({ _id: id });
    if (!characterPart) {
      error('updateUsersCharacter: Invalid character part', { from, to, id, userId: user._id });
      throw new Meteor.Error('invalid-character-part', 'Trying to set an invalid part');
    }

    Characters.update(id, { $set: { category: to } });

    if (from) {
      Meteor.users.update(
        { [`profile.${from}`]: id },
        {
          $unset: { [`profile.${from}`]: 1 },
          $set: { [`profile.${to}`]: id },
        },
        { multi: true },
      );
    }

    return true;
  },
});
