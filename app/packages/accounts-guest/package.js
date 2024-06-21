/* cSpell: disable */
// Modification of baursn:accounts-guest to add compatibility with meteor 2.X
Package.describe({
  summary: 'Automatically add visitor as anonymous guest with userId',
  version: '0.0.1',
  name: 'accounts-guest',
});

Package.onUse(api => {
  api.versionsFrom('2.3.2');

  api.use('underscore');
  api.use('accounts-base');

  // ===========================================
  // accounts-patch-ui
  // ===========================================
  api.use('templating', 'client');
  api.use('tracker', 'client');
  api.use('accounts-ui-unstyled', 'client', { weak: true });
  api.use('ian:accounts-ui-bootstrap-3@1.0.0 || 0.1.0', 'client', { weak: true });
  api.use('brettle:accounts-add-service@1.0.0', { weak: true });
  api.use('useraccounts:bootstrap@1.12.0', 'client', { weak: true });
  api.use('useraccounts:foundation@1.12.0', 'client', { weak: true });
  api.use('useraccounts:ionic@1.12.0', 'client', { weak: true });
  api.use('useraccounts:materialize@1.12.0', 'client', { weak: true });
  api.use('useraccounts:polymer@1.12.0', 'client', { weak: true });
  api.use('useraccounts:ratchet@1.12.0', 'client', { weak: true });
  api.use('useraccounts:semantic-ui@1.12.0', 'client', { weak: true });
  api.use('useraccounts:unstyled@1.12.0', 'client', { weak: true });

  api.use('blaze@=2.7.1', 'client');
  api.use(
    'iron:router@=1.0.13 || 1.0.12 || =1.0.11 || =1.0.10 || =1.0.9',
    'client',
    { weak: true },
  );
  api.use(
    'kadira:flow-router' +
    '@=2.12.1 || =2.10.1 || =2.9.0 || =2.8.0 || =2.7.0 || =2.6.2 || =2.5.0',
    'client',
    { weak: true },
  );

  api.use('useraccounts:iron-routing@1.12.1', 'client', { weak: true });
  api.use('useraccounts:flow-routing@1.12.0', 'client', { weak: true });
  api.addFiles('accounts-patch-ui.js', 'client');
  api.addFiles('patch-accounts-ui-unstyled.js', 'client');
  api.addFiles('patch-ian_accounts-ui-bootstrap-3.js', 'client');
  api.addFiles('patch-useraccounts.js', 'client');

  // ===========================================
  // accounts-login-state
  // ===========================================
  api.use('tracker');
  api.use('reactive-var');
  api.use('callback-hook', 'server');
  api.use('service-configuration', ['client', 'server']);
  api.use('accounts-password', 'server', { weak: true });
  api.addFiles('accounts-login-state-client.js', 'client');
  api.addFiles('accounts-login-state-server.js', 'server');
  api.use('oauth', ['client', 'server']);
  api.use('oauth2', ['client', 'server']);
  api.use('accounts-oauth', ['client', 'server']);
  api.addFiles('accounts-oauth-server.js', 'server');
  api.addFiles('accounts-oauth-client.js', 'client');
  // ===========================================
  // accounts-guest
  // ===========================================
  api.use(['mongo', 'check', 'random'], 'server');
  api.use('accounts-password', 'server', { weak: true });
  api.use('underscore', 'server');
  api.use('brettle:accounts-multiple@0.3.0', ['client', 'server'], { weak: true });
  api.addFiles('accounts-guest.js', ['client', 'server']);
  api.export('AccountsGuest');
  api.addFiles('accounts-guest-server.js', 'server');
  api.addFiles('accounts-guest-client.js', 'client');
  api.use('twitter-oauth', ['client', 'server']);
  api.use('accounts-twitter', ['client', 'server']);
  api.use('github-oauth', ['client', 'server']);
  api.use('accounts-github', ['client', 'server']);
  api.use('facebook-oauth', ['client', 'server']);
  api.use('accounts-facebook', ['client', 'server']);
  api.use('google-oauth', ['client', 'server']);
  api.use('accounts-google', ['client', 'server']);
  api.export(['AccountsPatchUi', 'AccountsGuest', 'capitalize', 'ServiceConfiguration', 'LoginState'], ['client', 'server']);
});

Npm.depends({
  moniker: '0.1.2',
});
