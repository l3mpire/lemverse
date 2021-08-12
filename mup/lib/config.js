const cjson = require('cjson');
const path = require('path');
const fs = require('fs');
const { format } = require('util');
const helpers = require('./helpers');

require('colors');

exports.read = function () {
  const mupJsonPath = path.resolve('mup.json');
  if (fs.existsSync(mupJsonPath)) {
    const mupJson = cjson.load(mupJsonPath);

    // initialize options
    mupJson.env = mupJson.env || {};

    if (typeof mupJson.setupNode === 'undefined') {
      mupJson.setupNode = true;
    }
    if (typeof mupJson.setupPhantom === 'undefined') {
      mupJson.setupPhantom = true;
    }
    mupJson.meteorBinary = (mupJson.meteorBinary) ? getCanonicalPath(mupJson.meteorBinary) : 'meteor';
    if (typeof mupJson.appName === 'undefined') {
      mupJson.appName = 'meteor';
    }
    if (typeof mupJson.enableUploadProgressBar === 'undefined') {
      mupJson.enableUploadProgressBar = true;
    }

    // validating servers
    if (!mupJson.servers || mupJson.servers.length === 0) {
      mupErrorLog('Server information does not exist');
    } else {
      mupJson.servers.forEach(server => {
        let sshAgentExists = false;
        const sshAgent = process.env.SSH_AUTH_SOCK;
        if (sshAgent) {
          sshAgentExists = fs.existsSync(sshAgent);
          server.sshOptions = server.sshOptions || {};
          server.sshOptions.agent = sshAgent;
        }

        if (!server.host) {
          mupErrorLog('Server host does not exist');
        } else if (!server.username) {
          mupErrorLog('Server username does not exist');
        } else if (!server.password && !server.pem && !sshAgentExists) {
          mupErrorLog('Server password, pem or a ssh agent does not exist');
        } else if (!mupJson.app) {
          mupErrorLog('Path to app does not exist');
        }

        server.os = server.os || 'linux';

        if (server.pem) server.pem = rewriteHome(server.pem);

        server.env = server.env || {};
        const defaultEndpointUrl = format('http://%s:%s', server.host, mupJson.env.PORT || 80);
        server.env.CLUSTER_ENDPOINT_URL = server.env.CLUSTER_ENDPOINT_URL || defaultEndpointUrl;
      });
    }

    // rewrite ~ with $HOME
    mupJson.app = rewriteHome(mupJson.app);

    if (mupJson.ssl) {
      mupJson.ssl.backendPort = mupJson.ssl.backendPort || 80;
      mupJson.ssl.pem = path.resolve(rewriteHome(mupJson.ssl.pem));
      if (!fs.existsSync(mupJson.ssl.pem)) {
        mupErrorLog('SSL pem file does not exist');
      }
    }

    return mupJson;
  } else {
    console.error('mup.json file does not exist!'.red.bold);
    helpers.printHelp();
    process.exit(1);
  }
};

function rewriteHome(location) {
  if (/^win/.test(process.platform)) {
    return location.replace('~', process.env.USERPROFILE);
  } else {
    return location.replace('~', process.env.HOME);
  }
}

function mupErrorLog(message) {
  const errorMessage = `Invalid mup.json file: ${message}`;
  console.error(errorMessage.red.bold);
  process.exit(1);
}

function getCanonicalPath(location) {
  const localDir = path.resolve(__dirname, location);
  if (fs.existsSync(localDir)) {
    return localDir;
  } else {
    return path.resolve(rewriteHome(location));
  }
}
