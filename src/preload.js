const { contextBridge, ipcRenderer } = require('electron');

// Expose Electron detection to the web app
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveStationUrl: (url) => ipcRenderer.invoke('save-station-url', url),
  getStationUrl: () => ipcRenderer.invoke('get-station-url'),
});

// Also set a simple flag the web app can check
contextBridge.exposeInMainWorld('isElectronApp', true);
