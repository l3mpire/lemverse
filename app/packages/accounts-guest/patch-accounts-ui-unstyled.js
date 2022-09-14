/* eslint-disable */
/* cSpell: disable */
"use strict";
/* globals AccountsPatchUi */

if (Package['accounts-ui-unstyled']) {
  if (Template.loginButtons) {
    // Override global currentUser to hide users who are logged in but not
    // signed up, just for this template.
    Template.loginButtons.helpers({
      currentUser: AccountsPatchUi.wrapWithSignedUp(function () {
        return Meteor.user();
      })
    });
  }

  if (Template._loginButtonsLoggedOutDropdown) {
    AccountsPatchUi._wrapTemplate(Template._loginButtonsLoggedOutDropdown);
  }
}
