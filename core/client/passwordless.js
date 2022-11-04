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

const checkJWT = jwt => {
  if (!jwt) return;
  Accounts.callLoginMethod({
    methodArguments: [{ jwt }],
    userCallback: err => {
      if (err) {
        lp.notif.error(err.message);
        throw err;
      }
    },
  });
};

/**
 * Parse querystring for token argument, if found use it to auto-login
 */
Accounts.autoLoginWithToken = function () {
  const params = new URL(window.location.href).searchParams;

  if (params.get('loginToken')) {
    checkToken({
      selector: params.get('selector'),
      token: params.get('loginToken'),
    });
  } else if (params.get('token')) {
    checkJWT(params.get('token'));
  }
};
