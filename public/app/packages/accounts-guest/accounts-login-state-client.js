/* eslint-disable */
/* globals LoginState: true, Hook */
"use strict";

function LoginStateConstructor() {
  var self = this;
  self._loggedIn = new ReactiveVar();
  Tracker.autorun(function () {
    self._loggedIn.set(!! Meteor.userId());
  });
  self._signedUp = new ReactiveVar();
  Tracker.autorun(function () {
    // If the user is not logged in then they can't be signed in. Period.
    if (!self.loggedIn()) {
      self._signedUp.set(false);
      return;
    }
    var user = Meteor.user();
    if (!user || user.loginStateSignedUp === undefined) {
      self._signedUp.set(false);
      return;
    }
    self._signedUp.set(user.loginStateSignedUp);
  });
}

LoginStateConstructor.prototype.loggedIn = function () {
  return this._loggedIn.get();
};

LoginStateConstructor.prototype.signedUp = function () {
  return this._signedUp.get();
};

LoginState = new LoginStateConstructor();