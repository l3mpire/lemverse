/* eslint-disable */
AccountsGuest = {};
if (typeof AccountsGuest.forced === 'undefined') {
  AccountsGuest.forced = true; /* default to making loginVisitor automatic, and on logout */
}
if (typeof AccountsGuest.enabled === 'undefined') {
  AccountsGuest.enabled = true; /* on 'false'  Meteor.loginVisitor() will fail */
}
if (typeof AccountsGuest.name === 'undefined') {
  AccountsGuest.name = false; /* defaults to returning "null" for user's name */
}
if (typeof AccountsGuest.anonymous === 'undefined') {
  AccountsGuest.anonymous = false; /* defaults to using guests with randomly generated usernames/emails */
}
