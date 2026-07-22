const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const subscription = (_event, ...payload) => listener(...payload);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener),

  // ── Auto-Update API (typed channels, no raw strings in renderer) ──────────
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  applyUpdate: (opts) => ipcRenderer.invoke('update:apply', opts),
  installUpdate: (opts) => ipcRenderer.invoke('update:install', opts),
  onUpdateProgress: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
  onUpdateAvailable: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  setAutoCheck: (enabled) => ipcRenderer.send('update:setAutoCheck', enabled),
  getAutoCheck: () => ipcRenderer.invoke('update:getAutoCheck'),

  // ── Clipboard monitoring API ─────────────────────────────────────────────
  clipboardStartMonitoring: () => ipcRenderer.send('clipboard:startMonitoring'),
  clipboardStopMonitoring: () => ipcRenderer.send('clipboard:stopMonitoring'),
  clipboardGetText: () => ipcRenderer.invoke('clipboard:getText'),
  onClipboardUrlDetected: (cb) => {
    const listener = (_event, url) => cb(url);
    ipcRenderer.on('clipboard:url-detected', listener);
    return () => ipcRenderer.removeListener('clipboard:url-detected', listener);
  },

  // ── Browser extension status ─────────────────────────────────────────────
  isExtensionConnected: () => ipcRenderer.invoke('extension:isConnected'),
  onExtensionStatus: (cb) => {
    const listener = (_event, connected) => cb(connected);
    ipcRenderer.on('extension:status', listener);
    return () => ipcRenderer.removeListener('extension:status', listener);
  },
});
