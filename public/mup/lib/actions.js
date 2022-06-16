const nodemiral = require('@zodern/nodemiral');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const uuid = require('uuid');
const { format } = require('util');
const extend = require('util')._extend;
const _ = require('underscore');
const async = require('async');
const os = require('os');
const buildApp = require('./build.js');
require('colors');

module.exports = Actions;

function Actions(config, cwd) {
  this.cwd = cwd;
  this.config = config;
  this.sessionsMap = this._createSessionsMap(config);

  // get settings.json into env
  const settingsJsonPath = path.resolve(this.cwd, 'settings.json');
  if (fs.existsSync(settingsJsonPath)) {
    this.config.env.METEOR_SETTINGS = JSON.stringify(require(settingsJsonPath));
  }
}

Actions.prototype._createSessionsMap = function (config) {
  const sessionsMap = {};

  config.servers.forEach(server => {
    const { host } = server;
    const auth = { username: server.username };

    if (server.pem) {
      auth.pem = fs.readFileSync(path.resolve(server.pem), 'utf8');
    } else {
      auth.password = server.password;
    }

    const nodemiralOptions = {
      ssh: server.sshOptions,
      keepAlive: true,
    };

    if (!sessionsMap[server.os]) {
      sessionsMap[server.os] = {
        sessions: [],
        taskListsBuilder: require('./taskLists')(server.os),
      };
    }

    const session = nodemiral.session(host, auth, nodemiralOptions);
    session._serverConfig = server;
    sessionsMap[server.os].sessions.push(session);
  });

  return sessionsMap;
};

Actions.prototype._executeParallel = function (actionName, args) {
  const self = this;
  const sessionInfoList = _.values(self.sessionsMap);
  async.map(
    sessionInfoList,
    (sessionsInfo, callback) => {
      const taskList = sessionsInfo.taskListsBuilder[actionName].apply(sessionsInfo.taskListsBuilder, args);
      taskList.run(sessionsInfo.sessions, summaryMap => {
        callback(null, summaryMap);
      });
    },
    whenAfterCompleted,
  );
};

Actions.prototype.setup = function () {
  this._executeParallel('setup', [this.config]);
};

Actions.prototype.deploy = function () {
  const self = this;

  const buildLocation = path.resolve(os.tmpdir(), uuid.v4());
  const bundlePath = path.resolve(buildLocation, 'bundle.tar.gz');

  // spawn inherits env vars from process.env
  // so we can simply set them like this
  process.env.BUILD_LOCATION = buildLocation;

  const { deployCheckWaitTime } = this.config;
  const { appName, masterName } = this.config;
  const appPath = this.config.app;
  const { enableUploadProgressBar } = this.config;
  const { meteorBinary } = this.config;

  console.log(`Building Started: ${this.config.app}`);
  buildApp(appPath, meteorBinary, buildLocation, err => {
    if (err) {
      process.exit(1);
    } else {
      const sessionsData = [];
      _.forEach(self.sessionsMap, sessionsInfo => {
        const { taskListsBuilder } = sessionsInfo;
        _.forEach(sessionsInfo.sessions, session => {
          sessionsData.push({
            taskListsBuilder,
            session,
          });
        });
      });

      async.mapSeries(
        sessionsData,
        (sessionData, callback) => {
          const { session } = sessionData;
          const { taskListsBuilder } = sessionData;
          const env = _.extend({}, self.config.env, session._serverConfig.env);
          const taskList = taskListsBuilder.deploy(
            bundlePath, env,
            deployCheckWaitTime, appName, masterName, enableUploadProgressBar,
          );
          taskList.run(session, summaryMap => {
            callback(null, summaryMap);
          });
        },
        whenAfterDeployed(buildLocation),
      );
    }
  });
};

Actions.prototype.reconfig = function () {
  const self = this;
  const sessionInfoList = [];
  for (const os in self.sessionsMap) {
    var sessionsInfo = self.sessionsMap[os];
    sessionsInfo.sessions.forEach(session => {
      const env = _.extend({}, self.config.env, session._serverConfig.env);
      const taskList = sessionsInfo.taskListsBuilder.reconfig(
        env, self.config.appName,
      );
      sessionInfoList.push({
        taskList,
        session,
      });
    });
  }

  async.mapSeries(
    sessionInfoList,
    (sessionInfo, callback) => {
      sessionInfo.taskList.run(sessionInfo.session, summaryMap => {
        callback(null, summaryMap);
      });
    },
    whenAfterCompleted,
  );
};

Actions.prototype.restart = function () {
  this._executeParallel('restart', [this.config.appName]);
};

Actions.prototype.stop = function () {
  this._executeParallel('stop', [this.config.appName]);
};

Actions.prototype.start = function () {
  this._executeParallel('start', [this.config.appName]);
};

Actions.prototype.logs = function () {
  const self = this;
  const tailOptions = process.argv.slice(3).join(' ');

  for (var os in self.sessionsMap) {
    const sessionsInfo = self.sessionsMap[os];
    sessionsInfo.sessions.forEach(session => {
      const hostPrefix = `[${session._host}] `;
      const options = {
        onStdout(data) {
          process.stdout.write(hostPrefix + data.toString());
        },
        onStderr(data) {
          process.stderr.write(hostPrefix + data.toString());
        },
      };

      if (os == 'linux') {
        var command = `sudo tail ${tailOptions} /var/log/upstart/${self.config.appName}.log`;
      } else if (os == 'sunos') {
        var command = `sudo tail ${tailOptions
        } /var/svc/log/site-${self.config.appName}\\:default.log`;
      }
      session.execute(command, options);
    });
  }
};

Actions.init = function () {
  const destMupJson = path.resolve('mup.json');
  const destSettingsJson = path.resolve('settings.json');

  if (fs.existsSync(destMupJson) || fs.existsSync(destSettingsJson)) {
    console.error('A Project Already Exists'.bold.red);
    process.exit(1);
  }

  const exampleMupJson = path.resolve(__dirname, '../example/mup.json');
  const exampleSettingsJson = path.resolve(__dirname, '../example/settings.json');

  copyFile(exampleMupJson, destMupJson);
  copyFile(exampleSettingsJson, destSettingsJson);

  console.log('Empty Project Initialized!'.bold.green);

  function copyFile(src, dest) {
    const content = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, content);
  }
};

function storeLastNChars(vars, field, limit, color) {
  return function (data) {
    vars[field] += data.toString();
    if (vars[field].length > 1000) {
      vars[field] = vars[field].substring(vars[field].length - 1000);
    }
  };
}

function whenAfterDeployed(buildLocation) {
  return function (error, summaryMaps) {
    rimraf.sync(buildLocation);
    whenAfterCompleted(error, summaryMaps);
  };
}

function whenAfterCompleted(error, summaryMaps) {
  const errorCode = error || haveSummaryMapsErrors(summaryMaps) ? 1 : 0;
  process.exit(errorCode);
}

function haveSummaryMapsErrors(summaryMaps) {
  return _.some(summaryMaps, hasSummaryMapErrors);
}

function hasSummaryMapErrors(summaryMap) {
  return _.some(summaryMap, summary => summary.error);
}
