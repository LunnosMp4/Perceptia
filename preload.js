const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureRegion: (region, mode) => ipcRenderer.invoke('capture-region', region, mode),
  cancelOverlay: () => ipcRenderer.invoke('cancel-overlay')
});