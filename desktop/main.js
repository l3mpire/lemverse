const { ipcMain, app, dialog, globalShortcut, shell, desktopCapturer, BrowserWindow, Menu, Tray } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { setupScreenSharingMain } = require('@jitsi/electron-sdk');

const path = require('path');
const settings = require('./settings.json');

const isDev = !app.isPackaged;
const appURL = isDev ? 'http://localhost:9000' : settings.website;
const iconPath = `${__dirname}/assets/icon-tray.png`;

let autoCloseCallback;
let tray;
let mainWindow;
let wasFullscreen = false;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Hot-reload
if (isDev) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const electron = require(`${__dirname}/node_modules/electron`);
  // eslint-disable-next-line global-require
  require('electron-reload')(__dirname, { electron });
}

// Allow multi-screens window
if (process.platform === 'darwin') app.dock.hide();

// We need this because of https://github.com/electron/electron/issues/18214, doc: https://github.com/jitsi/jitsi-meet-electron-sdk#note
app.commandLine.appendSwitch('disable-site-isolation-trials');

// Enable optional PipeWire support.
if (!app.commandLine.hasSwitch('enable-features')) app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');

const cancelWindowAutoClose = () => clearTimeout(autoCloseCallback);

const calculateWindowPositionUnderTrayIcon = () => {
  const windowBounds = mainWindow.getBounds();
  const trayBounds = tray.getBounds();

  return {
    x: Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2)),
    y: Math.round(trayBounds.y + trayBounds.height + 4),
  };
};

const showWindow = (autoFocus = false) => {
  if (!mainWindow) return;
  if (autoFocus) mainWindow.show();
  else mainWindow.showInactive();
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: settings.window.width,
    height: settings.window.height,
    backgroundColor: '#222',
    frame: false,
    show: false,
    maximizable: true,
    fullscreenable: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    closable: true,
    autoHideMenuBar: true,
    transparent: false,
    shadow: false,
    contextIsolation: false,
    webPreferences: {
      enableRemoteModule: false,
      contextIsolation: false,
      nativeWindowOpen: true,
      nodeIntegration: false,
      webSecurity: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(appURL);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setSkipTaskbar(true);
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.on('focus', () => cancelWindowAutoClose());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => showWindow(true));

  // open target="_blank" links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

const toggleWindow = (value, autoFocus = false) => {
  if (value !== undefined) {
    if (value) showWindow(autoFocus);
    else mainWindow.hide();
  } else if (mainWindow?.isVisible()) mainWindow.hide();
  else showWindow(autoFocus);
};

const toggleFullScreen = value => {
  if (!mainWindow) return;
  wasFullscreen = false;
  if (value !== undefined) mainWindow.setFullScreen(value);
  else mainWindow.setFullScreen(!mainWindow.isFullScreen());
};

const createTrayMenu = () => {
  tray = new Tray(iconPath);
  tray.setToolTip('lemverse');
  tray.setIgnoreDoubleClickEvents(true);

  const menu = Menu.buildFromTemplate([{
    label: `lemverse (v${app.getVersion()})`, click() { autoUpdater.checkForUpdates(); },
  }, {
    label: 'Debug', click() { mainWindow?.openDevTools(); },
  }, {
    role: 'quit',
  }]);

  tray.on('right-click', () => tray.popUpContextMenu(menu));
  tray.on('click', () => toggleWindow(undefined, true));
};

const initJitsi = () => {
  setupScreenSharingMain(mainWindow, settings.name, settings.appBundleId);
};

app.whenReady().then(() => {
  createWindow();
  createTrayMenu();
  initJitsi();

  // Hide icon in the dock
  if (process.platform === 'darwin') app.dock.hide();

  // Shortcut
  globalShortcut.register('Alt+Cmd+v', () => {
    // the user wants to hide the app currently in fullscreen
    if (mainWindow.isFullScreen() && mainWindow.isVisible()) {
      mainWindow.once('leave-full-screen', () => {
        wasFullscreen = true;
        toggleWindow(false, true);
      });
      toggleFullScreen(false);
      return;
    }

    // the user wants to show the app previously in fullscreen
    if (!mainWindow.isVisible() && wasFullscreen) {
      mainWindow.once('enter-full-screen', () => toggleWindow(true, true));
      toggleFullScreen(true);
      return;
    }

    toggleWindow(undefined, true);
  });

  // Set the window under the tray icon on first load
  const position = calculateWindowPositionUnderTrayIcon();
  mainWindow.setPosition(position.x, position.y, false);

  if (!isDev) {
    autoUpdater.checkForUpdates();
    setInterval(() => autoUpdater.checkForUpdates(), settings.checkUpdateInterval);
  }
});

ipcMain.on('asynchronous-message', (event, data) => {
  if (data.command === 'proximity-started') {
    if (!mainWindow.isVisible()) {
      cancelWindowAutoClose();
      autoCloseCallback = setTimeout(() => {
        toggleWindow(false);
      }, settings.window.autoCloseDelay);
    }

    toggleWindow(true, false);
  } else if (data.command === 'toggle-fullscreen') toggleFullScreen();
});

autoUpdater.on('update-downloaded', () => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: '',
    detail: 'A new version has been downloaded. Restart the application to apply the updates.',
  };

  dialog.showMessageBox(dialogOpts).then(returnValue => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', message => {
  console.error('There was a problem updating the application');
  console.error(message);
});

ipcMain.handle(
  'DESKTOP_CAPTURER_GET_SOURCES',
  (event, opts) => desktopCapturer.getSources(opts),
);
