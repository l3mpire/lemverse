const { ipcRenderer } = require('electron');

window.addEventListener('message', e => ipcRenderer.send('asynchronous-message', e.data), false);
