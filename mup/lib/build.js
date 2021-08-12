/* eslint-disable no-console */

const { spawn } = require('child_process');
const archiver = require('archiver');
const fs = require('fs');
const pathResolve = require('path').resolve;
const _ = require('underscore');

function buildMeteorApp(appPath, meteorBinary, buildLocation, callback) {
  let executable = meteorBinary;
  let args = [
    'build', '--directory', buildLocation,
    '--architecture', 'os.linux.x86_64',
    '--server', 'http://localhost:3000',
    '--server-only',
  ];

  const isWin = /^win/.test(process.platform);
  if (isWin) {
    // Sometimes cmd.exe not available in the path
    // See: http://goo.gl/ADmzoD
    executable = process.env.comspec || 'cmd.exe';
    args = ['/c', 'meteor'].concat(args);
  }

  const options = { cwd: appPath };
  const meteor = spawn(executable, args, options);
  const stdout = '';
  const stderr = '';

  meteor.stdout.pipe(process.stdout, { end: false });
  meteor.stderr.pipe(process.stderr, { end: false });

  meteor.on('close', callback);
}

function buildApp(appPath, meteorBinary, buildLocation, callback) {
  // callback(); return;

  buildMeteorApp(appPath, meteorBinary, buildLocation, code => {
    if (code === 0) {
      callback();
    } else {
      console.log('\n=> Build Error. Check the logs printed above.');
      callback(new Error('build-error'));
    }
  });
}

module.exports = buildApp;
