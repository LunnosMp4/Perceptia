const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureRegion: (region, mode) => ipcRenderer.invoke('capture-region', region, mode),
  cancelOverlay: () => ipcRenderer.invoke('cancel-overlay'),
  saveLanguage: (language) => ipcRenderer.invoke('save-language', language),
});