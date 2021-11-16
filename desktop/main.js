const { ipcMain, app, globalShortcut, BrowserWindow, Menu, Tray } = require('electron');
const path = require('path');
const settings = require('./settings.json');

const isDev = !app.isPackaged;
const appURL = isDev ? 'http://localhost:9000' : settings.website;
const iconPath = `${__dirname}/assets/icon-tray.png`;
let tray;
let window;
let autoCloseCallback;

// Allow multi-screens window
if (process.platform === 'darwin') app.dock.hide();

const cancelWindowAutoClose = () => clearTimeout(autoCloseCallback);

const calculateWindowPositionUnderTrayIcon = () => {
  const windowBounds = window.getBounds();
  const trayBounds = tray.getBounds();

  return {
    x: Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2)),
    y: Math.round(trayBounds.y + trayBounds.height + 4),
  };
};

const createWindow = () => {
  window = new BrowserWindow({
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
    transparent: true,
    shadow: true,
    webPreferences: {
      webSecurity: !isDev,
      devTools: isDev,
      preload: path.join(__dirname, 'renderer.js'),
    },
  });

  window.loadURL(appURL);
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setSkipTaskbar(true);
  window.setVisibleOnAllWorkspaces(true);
  window.on('focus', () => cancelWindowAutoClose());
};

const showWindow = (autoFocus = false) => {
  if (!window) createWindow();
  if (autoFocus) window.show();
  else window.showInactive();
};

const toggleWindow = (value, autoFocus = false) => {
  if (value !== undefined) {
    if (value) showWindow(autoFocus);
    else window.hide();
  } else if (window?.isVisible()) window.hide();
  else showWindow(autoFocus);
};

const toggleFullScreen = () => {
  if (!window) return;
  window.setFullScreen(!window.isFullScreen());
};

const createTrayMenu = () => {
  tray = new Tray(iconPath);
  tray.setToolTip('lemverse');
  tray.setIgnoreDoubleClickEvents(true);

  const menu = Menu.buildFromTemplate([{
    label: 'Debug', click() { window?.openDevTools(); },
  }, {
    role: 'quit',
  }]);

  tray.on('right-click', () => tray.popUpContextMenu(menu));
  tray.on('click', () => toggleWindow(undefined, true));
};

app.whenReady().then(() => {
  createWindow();
  createTrayMenu();

  // Hide icon in the dock
  if (process.platform === 'darwin') app.dock.hide();

  // Shortcut
  globalShortcut.register('Alt+Cmd+v', () => toggleWindow(undefined, true));

  // set the window under the tray icon on first load
  const position = calculateWindowPositionUnderTrayIcon();
  window.setPosition(position.x, position.y, false);
});

ipcMain.on('asynchronous-message', (event, message) => {
  let data;
  try {
    data = JSON.parse(message);
  } catch (err) { return; }

  if (!data || !data.command) {
    console.error('ipcMain: received a message without command', { message });
    return;
  }

  if (data.command === 'proximity-started') {
    if (!window.isVisible()) {
      cancelWindowAutoClose();
      autoCloseCallback = setTimeout(() => {
        toggleWindow(false);
      }, settings.window.autoCloseDelay);
    }

    toggleWindow(true, false);
  } else if (data.command === 'toggle-fullscreen') toggleFullScreen();
});
