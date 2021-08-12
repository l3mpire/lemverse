Meteor.methods({
  updateUsersCharacter(from, to, id) {
    log('updateUsersCharacter: start', { from, to, id });

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
