/* eslint-disable */
/* cSpell: disable */
/* globals ServiceConfiguration, Hook, LoginState: true */
"use strict";

function LoginStateConstructor() {
  var self = this;

  self._signedUpHook = new Hook({
    debugPrintExceptions: "LoginState signedUp interceptor callback",
  });

  self._interceptorsChangedHook = new Hook({
    debugPrintExceptions: "LoginState interceptorsChanged callback"
  });

  // If accounts-password is installed and the user has a username, or at
  // least one email address, then they are signed up.
  if (Package['accounts-password']) {
    self.addSignedUpInterceptor(function (u) {
      if (u && u.services && u.services.password &&
        (typeof (u.username) === 'string' ||
          (u.emails && u.emails[0] &&
            typeof (u.emails[0].address) === 'string'))) {
        u.loginStateSignedUp = true;
      }
    });
  }
  self.addSignedUpInterceptor(function (u) {
    var usedServices = _.keys(u.services);
    var configuredServices =
      ServiceConfiguration.configurations.find().map(function (config) {
        return config.service;
      });
    if (_.intersection(configuredServices, usedServices).length > 0) {
      u.loginStateSignedUp = true;
    }
  });
}

LoginStateConstructor.prototype.loggedIn = function () {
  return (!! Meteor.userId());
};

LoginStateConstructor.prototype.signedUp = function (user) {
  var self = this;
  if (user === undefined) {
    user = Meteor.user();
  }
  if (!user) {
    return false;
  }
  user.loginStateSignedUp = false;
  self._signedUpHook.each(function (cb) {
    cb(user);
    return true;
  });

  return user.loginStateSignedUp;
};

LoginStateConstructor.prototype.addSignedUpInterceptor = function (cb) {
  var self = this;
  var stopper = self._signedUpHook.register(cb);
  self._fireInterceptorsChanged();

  var origStop = stopper.stop;
  stopper.stop = function ( /* arguments */ ) {
    origStop.apply(this, arguments);
    self._fireInterceptorsChanged();
  };
  return stopper;
};

LoginStateConstructor.prototype._onInterceptorsChanged = function (cb) {
  var self = this;
  return self._interceptorsChangedHook.register(cb);
};

LoginStateConstructor.prototype._fireInterceptorsChanged = function () {
  var self = this;
  self._interceptorsChangedHook.each(function (cb) {
    cb();
    return true;
  });
};

LoginState = new LoginStateConstructor();

// Add a client-only `loginStateSignedUp` property to the current user record
// and keep it updated to refect whether the user has signed up according the
// the callbacks registered with `LoginState.addSignedUpInterceptor()`.
Meteor.publish(null, function () {
  var self = this;
  // The function to call to notify the subscriber. We initially set it to
  // self.added to workaround meteorhacks:fast-render issue #142
  // (https://github.com/kadirahq/fast-render/issues/142). Once self.added() is
  // called once, we set it to self.changed().
  var updateFunc = self.added.bind(self);
  
  if (!self.userId) {
    return null;
  }
  var userObserverStopper = Meteor.users.find({
    _id: self.userId
  }).observeChanges({
    added: updateLoginStateSignedUp,
    changed: updateLoginStateSignedUp
  });

  var configsObserverStopper =
    ServiceConfiguration.configurations.find().observe({
      added: updateLoginStateSignedUp,
      removed: updateLoginStateSignedUp
    });

  var interceptorsChangedStopper =
    LoginState._onInterceptorsChanged(updateLoginStateSignedUp);

  self.onStop(function () {
    userObserverStopper.stop();
    configsObserverStopper.stop();
    interceptorsChangedStopper.stop();
  });

  self.ready();

  function updateLoginStateSignedUp() {
    var user = Meteor.users.findOne({
      _id: self.userId
    });
    if (!user) {
      // user has been removed, so no need to change.
      // Also LoginState.signedUp() would call Meteor.user() if the user it is
      // passed is falsey, and that would trigger an console error about
      // needing to use this.userId instead.
      return;
    }
    updateFunc('users', self.userId, {
      loginStateSignedUp: LoginState.signedUp(user)
    });
    updateFunc = self.changed.bind(self);
  }
});