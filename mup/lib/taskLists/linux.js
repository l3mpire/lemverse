/* eslint-disable no-console */

const nodemiral = require('@zodern/nodemiral');
const path = require('path');
const execSync = require('child_process').execFileSync;

const SCRIPT_DIR = path.resolve(__dirname, '../../scripts/linux');
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates/linux');

nodemiral.registerTask('rsync', (session, options, callback) => {
  const bundlePath = options.src.replace('.tar.gz', '');
  const { dest } = options;
  // console.log('rsyncing...', { bundlePath, dest, session, options, callback });

  try {
    const res = execSync('/bin/bash', ['-c', `rsync -azch --delete --stats ${bundlePath}/ ${session._serverConfig.username}@${session._serverConfig.host}:${dest}/`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    console.log(res);
    callback();
  } catch (err) {
    callback(new Error(`rsync failed: ${err}`));
  }
});

exports.setup = function (config) {
  const taskList = nodemiral.taskList('Setup (linux)');

  // Configurations
  taskList.copy('Configuring systemd', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.service'),
    dest: `/lib/systemd/system/${config.appName}.service`,
    vars: { appName: config.appName, masterName: config.masterName },
  });

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.env'),
    dest: `/lib/systemd/system/${config.appName}.env`,
    vars: {
      env: {},
      appName: config.appName,
      masterName: config.masterName,
    },
  });

  // Installation
  if (config.appName === config.masterName) {
    if (config.setupNode) {
      taskList.executeScript('Installing Node.js', {
        script: path.resolve(SCRIPT_DIR, 'install-node.sh'),
        vars: { nodeVersion: config.nodeVersion },
      });
    }

    if (config.setupPhantom) {
      taskList.executeScript('Installing PhantomJS', {
        script: path.resolve(SCRIPT_DIR, 'install-phantomjs.sh'),
      });
    }

    taskList.executeScript('Setting up Environment for master', {
      script: path.resolve(SCRIPT_DIR, 'setup-env.sh'),
      vars: { appName: config.appName, masterName: config.masterName },
    });

    if (config.setupMongo) {
      taskList.executeScript('Installing MongoDB', {
        script: path.resolve(SCRIPT_DIR, 'install-mongodb.sh'),
      });
    }
  } else {
    taskList.executeScript('Setting up Environment for slave', {
      script: path.resolve(SCRIPT_DIR, 'setup-env-slave.sh'),
      vars: { appName: config.appName, masterName: config.masterName },
    });
  }

  return taskList;
};

exports.deploy = function (bundlePath, env, deployCheckWaitTime, appName, masterName, enableUploadProgressBar) {
  const taskList = nodemiral.taskList(`Deploy app '${appName}' on '${masterName}' (linux)`);

  taskList.rsync('Rsyncing bundle', {
    src: bundlePath,
    dest: `/opt/${masterName}/tmp/bundle`,
    progressBar: enableUploadProgressBar,
  });

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.env'),
    dest: `/lib/systemd/system/${appName}.env`,
    vars: { env: env || {}, appName },
  });

  // deploying
  taskList.executeScript('Invoking deployment process', {
    script: path.resolve(TEMPLATES_DIR, 'deploy.sh'),
    vars: { deployCheckWaitTime: deployCheckWaitTime || 10, appName },
  });

  return taskList;
};

exports.reconfig = function (env, appName) {
  const taskList = nodemiral.taskList('Updating configurations (linux)');

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.env'),
    dest: `/lib/systemd/system/${appName}.env`,
    vars: { env: env || {}, appName },
  });

  // restarting
  taskList.execute('Restarting app', {
    command: `(sudo systemctl stop ${appName} || :) && (sudo systemctl start ${appName})`,
  });

  return taskList;
};

exports.restart = function (appName) {
  const taskList = nodemiral.taskList('Restarting Application (linux)');

  // restarting
  taskList.execute('Restarting app', {
    command: `(sudo systemctl stop ${appName} || :) && (sudo systemctl start ${appName})`,
  });

  return taskList;
};

exports.stop = function (appName) {
  const taskList = nodemiral.taskList('Stopping Application (linux)');

  // stopping
  taskList.execute('Stopping app', {
    command: `(sudo systemctl stop ${appName})`,
  });

  return taskList;
};

exports.start = function (appName) {
  const taskList = nodemiral.taskList('Starting Application (linux)');

  // starting
  taskList.execute('Starting app', {
    command: `(sudo systemctl start ${appName})`,
  });

  return taskList;
};
