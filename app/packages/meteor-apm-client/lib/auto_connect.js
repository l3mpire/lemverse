Kadira._connectWithEnv = function () {
  if (process.env.KADIRA_APP_ID && process.env.KADIRA_APP_SECRET) {
    var options = Kadira._parseEnv(process.env);

    Kadira.connect(
      process.env.KADIRA_APP_ID,
      process.env.KADIRA_APP_SECRET,
      options
    );

    Kadira.connect = function () {
      throw new Error('Kadira has been already connected using credentials from Environment Variables');
    };
  }
};

Kadira._connectWithSettings = function () {
  if (
    Meteor.settings.kadira &&
    Meteor.settings.kadira.appId &&
    Meteor.settings.kadira.appSecret
  ) {
    const kadiraOptions = Meteor.settings.kadira.options || {};
    kadiraOptions.hash = process.env.COMMIT_HASH || 'default';
    Kadira.connect(
      Meteor.settings.kadira.appId,
      Meteor.settings.kadira.appSecret,
      kadiraOptions
    );

    Kadira.connect = function () {
      throw new Error('Kadira has been already connected using credentials from Meteor.settings');
    };
  }
};


// Try to connect automatically
Kadira._connectWithEnv();
Kadira._connectWithSettings();
