const { contextBridge, ipcRenderer} = require('electron/renderer')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node, 
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  datum: () => new Date().toLocaleDateString('de-DE'),
  wochentag: () => new Date().toLocaleString('de-DE', { weekday: 'long' })
})

contextBridge.exposeInMainWorld('windowDataAPI', {
  getMaxVisRows: () => ipcRenderer.invoke('get-max-visible-rows'),
  getPath: () => ipcRenderer.invoke('get-path'),
  onWindowData: (callback) => ipcRenderer.on('window-data', (_event, data) => callback(data))
});

contextBridge.exposeInMainWorld('vorlesungenDataAPI', {
  onVorlesungenData: (callback) => ipcRenderer.on('vorlesungen-data', (_event, data) => callback(data))
})

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getSelectedDisplay: () => ipcRenderer.invoke('get-selected-display'),
  setSelectedDisplay: (displayId) => ipcRenderer.invoke('set-selected-display', displayId),
  setMaxVisibleRows: (pRows) => ipcRenderer.invoke('set-max-visible-rows', pRows),
  getMaxVisibleRows: () => {
    try {
      return ipcRenderer.invoke('get-max-visible-rows');
    } catch (e) {
      console.warn('Fehler bei getMaxVisibleRows:', e);
      return Promise.resolve(null);
    }
  },
  setRelounchHour: (pRelHour) => ipcRenderer.invoke('set-relounch-hour', pRelHour),
  getRelounchHour: () => ipcRenderer.invoke('get-rel-hour'),
  setRelounchMinute: (pRelMinute) => ipcRenderer.invoke('set-relounch-minute', pRelMinute),
  getRelounchMinute: () => ipcRenderer.invoke('get-rel-min'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  loadVorlesungen: () => ipcRenderer.invoke('load-vorlesungen'),
  reloadWindows: () => ipcRenderer.invoke('reload-window')
});

