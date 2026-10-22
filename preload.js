// Exposes window.shift to the renderer. This is the whole API a design can use;
// see DESIGN_CONTRACT.md. renderer/mock-api.js implements the same surface for
// previewing a design in a plain browser.

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('shift', {
  isPreview: false,
  getState: () => ipcRenderer.invoke('shift:getState'),
  onState: (callback) => subscribe('shift:state', callback),
  onShortcut: (callback) => subscribe('shift:shortcut', callback),
  show: (accountId, serviceId) => ipcRenderer.invoke('shift:show', accountId, serviceId),
  addAccount: (account) => ipcRenderer.invoke('shift:addAccount', account),
  updateAccount: (id, patch) => ipcRenderer.invoke('shift:updateAccount', id, patch),
  removeAccount: (id) => ipcRenderer.invoke('shift:removeAccount', id),
  reorderAccounts: (ids) => ipcRenderer.invoke('shift:reorderAccounts', ids),
  setContentBounds: (rect) => ipcRenderer.send('shift:setContentBounds', rect),
  setOverlay: (open) => ipcRenderer.send('shift:setOverlay', open),
  navigate: (action) => ipcRenderer.send('shift:navigate', action),
});
