const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAIStream: (callback) => ipcRenderer.on('ai-stream', (event, chunk) => callback(chunk)),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  requestAIStream: () => ipcRenderer.invoke('request-ai-stream'),
});
