/* cSpell:disable */
Package.describe({
  name: 'lempire:lempire',
  version: '1.0.1',
  summary: 'boilerplate for lempire projects',
  git: '',
  documentation: 'README.md',
});

Npm.depends({
  jsdom: '16.4.0',
  dompurify: '2.0.15',
  pluralize: '7.0.0',
  'v8-profiler-node8': '6.2.0',
  noty: '3.2.0-beta',
  sweetalert: '2.1.2',
  '@mojs/core': '0.288.2',
  'underscore.string': '3.3.5',
  'fast-json-stable-stringify': '2.1.0',
  'prom-client': '12.0.0',
  'rate-limiter-flexible': '2.2.1',
});

Package.onUse(api => {
  api.versionsFrom('2.3.2');

  api.use([
    'ecmascript',
    'underscore',
    'meteor-base',
    'accounts-base',
    'momentjs:moment',
    'random',
    'jparker:crypto-md5',
    'check',
    'meteorhacks:picker',
  ]);

  api.use([
    'blaze-html-templates',
    'reactive-var',
    'tracker',
    'session',
  ], 'client');

  api.use([
    'meteorhacks:picker',
    'http',
    'mongo',
  ], 'server');

  api.addFiles([
    'lempire.js',
    'lempire-log.js',
    'lempire-admin.js',
    'lempire-collection.js',
  ], ['client', 'server']);

  api.addFiles([
    'lempire-helpers.js',
    'lempire-client.hbs.html',
    'lempire-client.js',
    'lempire-collection-client.js',
    'lempire-notif-client.js',
  ], 'client');

  api.addFiles([
    'lempire-server.js',
    'lempire-collection-server.js',
  ], 'server');

  api.addFiles([
    'lempire-lemverse-client.js',
  ], 'client');
  api.addFiles([
    'lempire-lemverse.js',
  ], ['client', 'server']);

  api.export(['lp', 'log', 'error', 'l', 'hijackGivenDBOps'], ['client', 'server']);
});
