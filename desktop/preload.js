const { contextBridge, desktopCapturer, ipcRenderer } = require('electron');
const { readFileSync } = require('fs');
const { join } = require('path');

window.addEventListener('message', e => ipcRenderer.send('asynchronous-message', e.data), false);

contextBridge.exposeInMainWorld('electronCustomDisplayMedia', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
  });

  return sources[0];
});

window.addEventListener('DOMContentLoaded', () => {
  const rendererScript = document.createElement('script');
  rendererScript.text = readFileSync(join(__dirname, 'renderer.js'), 'utf8');
  document.body.appendChild(rendererScript);
});
