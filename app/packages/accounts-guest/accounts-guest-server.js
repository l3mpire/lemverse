/* eslint-disable */
/* cSpell: disable */
Moniker = Npm.require('moniker');

Accounts.removeOldGuests = function (before) {
  if (typeof before === 'undefined') {
    before = new Date();
    before.setHours(before.getHours() - 1);
  }
  res = Meteor.users.remove({ createdAt: { $lte: before }, 'profile.guest': true });
  return res;
};
Accounts.registerLoginHandler('guest', options => {
  if (AccountsGuest.enabled === false || !options || !options.createGuest || Meteor.userId()) return undefined;

  let newUserId = null;

  if (AccountsGuest.anonymous) {
    if (options.email) {
      throw new Error('Can\'t create a guest user with an email with AccountsGuest.anonymous == true.\n');
    }
    newUserId = Accounts.insertUserDoc(options, { profile: { guest: true } });
  } else if (!Accounts.createUser) {
    throw new Error('Can\'t create a guest user with falsey AccountsGuest.anonymous unless the accounts-password package is installed.\n' +
            'Either set AccountsGuest.anonymous or run \'meteor add accounts-password\'.');
  } else {
    const guestOptions = createGuestOptions(options.email);

    newUserId = Accounts.createUser(guestOptions);
  }
  return {
    userId: newUserId,
  };
});

LoginState.addSignedUpInterceptor(user => {
  if (user.profile && user.profile.guest && AccountsGuest.name === false) {
    user.loginStateSignedUp = false;
  }
});

/**
 *  set profile.guest to false when guest adds a service
 *
 */
const bamPkg = Package['brettle:accounts-multiple'];
if (bamPkg) {
  bamPkg.AccountsMultiple.register({
    // brettle:accounts-add-service will cause onSwitchFailure to be called
    // when a service is added.
    // The new service will have been added to the attempting user.
    // In that case, we want to update profile.guest.
    onSwitchFailure(attemptingUser, attempt) {
      if (attemptingUser.profile && attemptingUser.profile.guest) {
        // Hide profile.guest so it doesn't effect LoginState.signedUp()
        delete attemptingUser.profile.guest;
        const signedUp = LoginState.signedUp(attemptingUser);

        attemptingUser.profile.guest = (!signedUp);
        Meteor.users.update(attemptingUser._id, {
          $set: {
            'profile.guest': attemptingUser.profile.guest,
          },
        });
      }
    },
  });
}
/**
 *  set profile.guest: drop guest user when visitor logs in as another user
 *
 */
GuestUsers = new Mongo.Collection('guestUsers');
Accounts.onLogin(par => {
  if (par.user && par.user.username !== undefined && par.user.username.indexOf('guest') !== -1) {
    if (!GuestUsers.findOne({ connection_id: par.connection.id })) {
      GuestUsers.insert({ connection_id: par.connection.id, user_id: par.user._id });
    }
  } else if (par.type !== 'resume') {
    const guest = GuestUsers.findOne({ connection_id: par.connection.id });
    if (guest) {
      Meteor.users.remove(guest.user_id);
      GuestUsers.remove(guest._id);
    }
  }
});

/* adapted from pull-request https://github.com/dcsan
* See https://github.com/artwells/meteor-accounts-guest/commit/28cbbf0eca2d80f78925ac619abf53d0769c0d9d
*/
Meteor.methods({
  createGuest(email) {
    const guest = createGuestOptions(email);
    Accounts.createUser(guest);
    //    console.log("createGuest" + guestname);
    return guest;
  },
});

function createGuestOptions(email) {
  check(email, Match.OneOf(String, null, undefined));

  /* if explicitly disabled, happily do nothing */
  if (AccountsGuest.enabled === false) {
    return true;
  }

  //    count = Meteor.users.find().count() + 1
  if (AccountsGuest.name === true) {
    guestname = Moniker.choose();
    // Just in case, let's make sure this name isn't taken
    while (Meteor.users.find({ username: guestname }).count() > 0) {
      guestname = Moniker.choose();
    }
  } else {
    guestname = `guest-#${Random.id()}`;
  }

  if (!email) {
    email = `${guestname}@example.com`;
  }

  guest = {
    username: guestname,
    email,
    profile: { guest: true },
    password: Random.id(),
  };
  return guest;
}
