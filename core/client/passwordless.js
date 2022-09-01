const checkToken = ({ selector, token }) => {
  if (!token) {
    return;
  }
  Meteor.passwordlessLoginWithToken(selector, token, () => {
    // Make it look clean by removing the authToken from the URL
    if (window.history) {
      const url = window.location.href.split('?')[0];
      window.history.pushState(null, null, url);
    }
  });
};

/**
 * Parse querystring for token argument, if found use it to auto-login
 */
Accounts.autoLoginWithToken = function () {
  Meteor.startup(() => {
    const params = new URL(window.location.href).searchParams;

    if (params.get('loginToken')) {
      checkToken({
        selector: params.get('selector'),
        token: params.get('loginToken'),
      });
    }
  });
};

// Run check for login token on page load
Meteor.startup(() => Accounts.autoLoginWithToken());
