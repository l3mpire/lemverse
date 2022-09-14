/* eslint-disable */
"use strict";
/* globals AccountsPatchUi */

if (Package['ian:accounts-ui-bootstrap-3'] && Template._loginButtons) {
  // Override global currentUser to hide users who are logged in but not
  // signed up, just for this template.
  Template._loginButtons.helpers({
    currentUser: AccountsPatchUi.wrapWithSignedUp(function () {
      return Meteor.user();
    })
  });
}
