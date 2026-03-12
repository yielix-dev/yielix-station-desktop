const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const Store = require('electron-store').default || require('electron-store');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Settings store
const store = new Store({
  defaults: {
    stationUrl: '',
    alwaysOnTop: true,
    autoLaunch: false,
    windowBounds: { width: 420, height: 720 },
  },
});

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ── Window Creation ─────────────────────────────────────────────

function createMainWindow() {
  const bounds = store.get('windowBounds');
  const alwaysOnTop = store.get('alwaysOnTop');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 360,
    minHeight: 500,
    alwaysOnTop: alwaysOnTop,
    title: 'YIELIX StaffApp',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Show in taskbar
    skipTaskbar: false,
  });

  // Load station URL or setup screen
  const stationUrl = store.get('stationUrl');
  if (stationUrl) {
    mainWindow.loadURL(stationUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'setup.html'));
  }

  // Save window position and size on move/resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const [width, height] = mainWindow.getSize();
      store.set('windowBounds', { width, height });
    }
  });

  // Close-to-tray behavior
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('/station/')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const stationUrl = store.get('stationUrl') || '';
    // Allow navigation within the station app domain
    if (stationUrl) {
      const stationDomain = new URL(stationUrl).origin;
      if (url.startsWith(stationDomain)) return;
    }
    // Allow setup page
    if (url.startsWith('file://')) return;
    // Block and open externally
    event.preventDefault();
    shell.openExternal(url);
  });
}

// ── App Icon ────────────────────────────────────────────────────

function getAppIcon() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'assets', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icon.png');

  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return null;
  }
}

function getTrayIcon() {
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '..', 'assets', 'tray-icon.png')
    : path.join(__dirname, '..', 'assets', 'icon.png');

  try {
    const icon = nativeImage.createFromPath(iconPath);
    // macOS tray icons should be 16x16 or 22x22
    if (process.platform === 'darwin') {
      return icon.resize({ width: 22, height: 22 });
    }
    return icon.resize({ width: 32, height: 32 });
  } catch {
    // Return a simple default icon if file not found
    return nativeImage.createEmpty();
  }
}

// ── System Tray ─────────────────────────────────────────────────

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('YIELIX StaffApp');

  updateTrayMenu();

  // Click tray icon to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu() {
  const alwaysOnTop = store.get('alwaysOnTop');
  const autoLaunch = store.get('autoLaunch');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show StaffApp',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Hide',
      click: () => {
        if (mainWindow) mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (menuItem) => {
        store.set('alwaysOnTop', menuItem.checked);
        if (mainWindow) mainWindow.setAlwaysOnTop(menuItem.checked);
        updateTrayMenu();
      },
    },
    {
      label: 'Launch on Startup',
      type: 'checkbox',
      checked: autoLaunch,
      click: (menuItem) => {
        store.set('autoLaunch', menuItem.checked);
        setAutoLaunch(menuItem.checked);
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Change Station URL',
      click: () => {
        store.set('stationUrl', '');
        if (mainWindow) {
          mainWindow.loadFile(path.join(__dirname, 'setup.html'));
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit StaffApp',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ── Auto Launch ─────────────────────────────────────────────────

function setAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });
}

// ── IPC from Setup Page ─────────────────────────────────────────

const { ipcMain } = require('electron');

ipcMain.handle('save-station-url', (event, url) => {
  store.set('stationUrl', url);
  if (mainWindow) {
    mainWindow.loadURL(url);
  }
  return { success: true };
});

ipcMain.handle('get-station-url', () => {
  return store.get('stationUrl') || '';
});

// ── App Lifecycle ───────────────────────────────────────────────

app.on('ready', () => {
  createMainWindow();
  createTray();

  // Apply auto-launch setting
  const autoLaunch = store.get('autoLaunch');
  if (autoLaunch) {
    setAutoLaunch(true);
  }
});

app.on('second-instance', () => {
  // Focus existing window if user tries to open another instance
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});
