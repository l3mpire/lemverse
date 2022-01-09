require('dotenv').config();
const { notarize } = require('electron-notarize');
const { appBundleId, appleId, appleIdPassword } = require('../settings.json');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  if (!appBundleId || !appleId || !appleId) {
    console.log('Skipping notarization');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  await notarize({
    appBundleId,
    appPath: `${appOutDir}/${appName}.app`,
    appleId,
    appleIdPassword,
  });
};
