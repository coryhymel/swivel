// Exposes window.swivel to the renderer. This is the whole API a design can use;
// see docs/ARCHITECTURE.md. renderer/mock-api.js implements the same surface for
// previewing a design in a plain browser.

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('swivel', {
  isPreview: false,
  getState: () => ipcRenderer.invoke('swivel:getState'),
  onState: (callback) => subscribe('swivel:state', callback),
  onShortcut: (callback) => subscribe('swivel:shortcut', callback),
  show: (accountId, serviceId) => ipcRenderer.invoke('swivel:show', accountId, serviceId),
  addAccount: (account) => ipcRenderer.invoke('swivel:addAccount', account),
  updateAccount: (id, patch) => ipcRenderer.invoke('swivel:updateAccount', id, patch),
  removeAccount: (id) => ipcRenderer.invoke('swivel:removeAccount', id),
  reorderAccounts: (ids) => ipcRenderer.invoke('swivel:reorderAccounts', ids),
  setContentBounds: (rect) => ipcRenderer.send('swivel:setContentBounds', rect),
  setOverlay: (open) => ipcRenderer.send('swivel:setOverlay', open),
  navigate: (action) => ipcRenderer.send('swivel:navigate', action),
});
