const { desktopCapturer, ipcRenderer } = require('electron');
const jitsiMeetElectronUtils = require('@jitsi/electron-sdk');

const { readFileSync } = require('fs');
const { join } = require('path');

window.addEventListener('message', e => {
  const { data } = e;
  if (!data?.command) {
    // log disabled to tue Jitsi spamming event and slowing down the app
    // console.error('ipcMain: received a message without command', { message: e.data });
    return;
  }

  // send to the main process
  ipcRenderer.send('asynchronous-message', data);
}, false);

// expose methods to the renderer unsafely (required by jitsi due to limitation to clone object like meet.api)
window.electron = {
  customDisplayMedia: async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
    });

    return sources[0];
  },
  jitsiMeetElectronUtils,
};

// inject renderer script inside the app
window.addEventListener('DOMContentLoaded', () => {
  const rendererScript = document.createElement('script');
  rendererScript.text = readFileSync(join(__dirname, 'renderer.js'), 'utf8');
  document.body.appendChild(rendererScript);
});
