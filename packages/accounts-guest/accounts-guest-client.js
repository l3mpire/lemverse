/* eslint-disable */
/** ***************
 * special anonymous behavior so that visitors can
 * manipulate their work
 *
 */

Meteor.loginVisitor = function (email, callback) {
  if (!Meteor.userId()) {
    Accounts.callLoginMethod({
      methodArguments: [{
        email,
        createGuest: true,
      }],
      userCallback(error, result) {
        if (error) {
          callback && callback(error);
        } else {
          callback && callback();
        }
      },
    });
  }
};

// no non-logged in users
/* you might need to limit this to avoid flooding the user db */
Meteor.startup(() => {
  Deps.autorun(() => {
    if (!Meteor.userId()) {
      if (AccountsGuest.forced === true) {
        Meteor.loginVisitor();
      }
    }
  });
});
