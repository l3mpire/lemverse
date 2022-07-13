// eslint-disable-next-line
let userAgent = 'Meteor';
if (Meteor.release) {
  userAgent += `/${Meteor.release}`;
}
const getAccessToken = (name, query, config) => {
  let response;
  const options = {
    headers: {
      Accept: 'application/json', 'User-Agent': userAgent,
    },
    params: {
      code: query.code,
      client_id: config.clientId,
      client_secret: OAuth.openSecret(config.secret),
      redirect_uri: OAuth._redirectUri(name, config),
      state: query.state,
      grant_type: 'authorization_code',
    },
  };

  try {
    response = HTTP.post(config.accessTokenUrl, options);
  } catch (err) {
    throw Object.assign(new Error(`OAuth: Failed to complete OAuth handshake. ${err.message}`), { response: err.response });
  }

  // if the http response was a json object with an error attribute
  if (response.data && response.data.error) {
    throw new Error(`Failed to complete OAuth handshake. ${response.data.error}`);
  } else {
    return response.data.access_token;
  }
};

const getIdentity = (accessToken, config) => {
  if (!config) {
    throw new ServiceConfiguration.ConfigError();
  }

  let response;
  const options = {
    headers: { Accept: 'application/json', 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` },
  };

  try {
    response = HTTP.get(config.identityUrl, options);
  } catch (err) {
    const errorResponse = err.response;
    console.error(errorResponse.data);
    throw new Meteor.Error(errorResponse.statusCode || '500', 'lea.OAuth.getIdentity.failed', errorResponse);
  }

  return response && response.data;
};

Accounts.setAdditionalFindUserOnExternalLogin(({ serviceName, serviceData }) => {
  log('setAdditionalFindUserOnExternalLogin:', { serviceName, serviceData });
  return Accounts.findUserByEmail(serviceData.email);
});

const initOAuthService = (name, config) => {
  if (!Match.test(name, String)) {
    throw new Error(`OAuth: bad or undefined oauth service name ${name}`);
  }
  if (!config) {
    throw new Error(`OAuth: no config for service ${name}`);
  }
  log(`OAuth: registering oauth service => ${name} `);
  Accounts.oauth.registerService(name);
  OAuth.registerService(name, 2, null, query => {
    const accessToken = getAccessToken(name, query, config);
    const identity = getIdentity(accessToken, config);
    const sealedToken = OAuth.sealSecret(accessToken);
    const profile = {};
    (config.identity || []).forEach(key => {
      profile[key] = identity[key];
    });

    // import additional fields from the identity token.
    const extraFields = {};
    (config.extraFields || []).forEach(key => {
      extraFields[key] = identity[key];
    });

    return {
      serviceData: {
        id: identity.sub,
        username: identity.email,
        accessToken: sealedToken,
        email: identity.email || '',
        ...extraFields,
      },
      options: {
        profile: {
          ...profile,
          name: identity.name,
          shareAudio: true,
          shareVideo: true,
        },
      },
    };
  });
};

const { updateOrCreateUserFromExternalService } = Accounts;

Accounts.updateOrCreateUserFromExternalService = function (serviceName, serviceData, options) {
  const result = updateOrCreateUserFromExternalService.apply(this, [serviceName, serviceData, options]);
  const user = Meteor.users.findOne(result.userId);
  if (!user.emails) {
    // first login through the sso provider, we proceed to the initialization of the profile
    completeUserProfile(user, serviceData.email, options.profile.name);
  }
  return result;
};

Meteor.startup(() => {
  ServiceConfiguration.configurations
    .find()
    .observe({
      added(record) {
        if (record.type === 'oauth' && record.custom) {
          initOAuthService(record.service, record);
        }
      },
    });
});
