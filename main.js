// Shift — main process.
// Owns accounts, one persistent session partition per Google account, and one
// WebContentsView per (account, service). The renderer (renderer/) only draws
// the chrome around the content slot and talks to us through preload.js.

const { app, BrowserWindow, WebContentsView, ipcMain, session, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVICES = [
  { id: 'mail', name: 'Gmail', url: 'https://mail.google.com/mail/u/0/' },
  { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com/calendar/u/0/r' },
  { id: 'drive', name: 'Drive', url: 'https://drive.google.com/drive/u/0/my-drive' },
];
const serviceById = (id) => SERVICES.find((s) => s.id === id);

const PALETTE = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#b31412', '#5f6368'];

// Google rejects sign-in from user agents that advertise Electron, so present
// as the plain Chrome build Electron is based on.
app.userAgentFallback = app.userAgentFallback.replace(/\s(?:Electron|shift|Shift)\/\S+/g, '');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// ---------------------------------------------------------------- config ----

const configFile = () => path.join(app.getPath('userData'), 'shift-config.json');
let config = { accounts: [], active: null, windowBounds: null };

function loadConfig() {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(configFile(), 'utf8')) };
  } catch {
    // First run or unreadable config: start empty.
  }
}

function saveConfig() {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2));
}

// Optional per-design window options, so a design can change the frame
// without touching this file. See DESIGN_CONTRACT.md.
function loadWindowOptions() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'renderer', 'window.json'), 'utf8'));
  } catch {
    return {};
  }
}

// ----------------------------------------------------------------- state ----

let win = null;
const views = new Map(); // `${accountId}:${serviceId}` -> WebContentsView
const unread = {}; // accountId -> number
const loading = {}; // view key -> boolean
const configuredSessions = new Set(); // accountIds
let overlay = false;
let contentBounds = { x: 0, y: 0, width: 0, height: 0 };

const viewKey = (accountId, serviceId) => `${accountId}:${serviceId}`;
const partitionFor = (accountId) => `persist:account-${accountId}`;
const findAccount = (id) => config.accounts.find((a) => a.id === id);

function snapshot() {
  return {
    accounts: config.accounts,
    services: SERVICES,
    palette: PALETTE,
    active: config.active,
    unread,
    loading,
  };
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('shift:state', snapshot());
}

// ----------------------------------------------------------------- views ----

const isGoogleHost = (host) =>
  host === 'google.com' || host.endsWith('.google.com') || host.endsWith('.googleusercontent.com');

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// Gmail wraps outbound links in https://www.google.com/url?q=<target>.
function unwrapGoogleRedirect(url) {
  try {
    const u = new URL(url);
    if (isGoogleHost(u.hostname) && u.pathname === '/url') return u.searchParams.get('q') || u.searchParams.get('url') || url;
  } catch {}
  return url;
}

function configureSession(accountId) {
  if (configuredSessions.has(accountId)) return;
  configuredSessions.add(accountId);
  const ses = session.fromPartition(partitionFor(accountId));
  ses.setUserAgent(app.userAgentFallback);
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'clipboard-read', 'media', 'fullscreen']);
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
}

function attachShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const action = shortcutFor(input);
    if (!action) return;
    event.preventDefault();
    runShortcut(action);
  });
}

function wireWebContents(wc, accountId, serviceId) {
  attachShortcuts(wc);

  wc.setWindowOpenHandler(({ url }) => {
    const target = unwrapGoogleRedirect(url);
    if (target === 'about:blank' || isGoogleHost(hostOf(target))) {
      // Google popups (Docs, Meet, attachments) stay signed in to this account.
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { partition: partitionFor(accountId), sandbox: true, contextIsolation: true },
        },
      };
    }
    if (/^https?:|^mailto:/.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });

  wc.on('did-create-window', (child) => {
    attachShortcuts(child.webContents);
    // A popup that lands somewhere outside Google belongs in the default browser.
    child.webContents.on('did-navigate', (_e, url) => {
      const target = unwrapGoogleRedirect(url);
      if (!isGoogleHost(hostOf(target)) && /^https?:/.test(target)) {
        shell.openExternal(target);
        child.close();
      }
    });
  });

  if (serviceId === 'mail') {
    wc.on('page-title-updated', (_e, title) => {
      // "Inbox (12) - someone@example.com - Gmail"
      const count = /\((\d[\d,]*)\)/.exec(title);
      unread[accountId] = count ? Number(count[1].replace(/,/g, '')) : 0;
      const email = / - ([^\s]+@[^\s]+) - Gmail/.exec(title);
      const account = findAccount(accountId);
      if (email && account && account.email !== email[1]) {
        account.email = email[1];
        saveConfig();
      }
      broadcast();
    });
  }

  const key = viewKey(accountId, serviceId);
  wc.on('did-start-loading', () => {
    loading[key] = true;
    broadcast();
  });
  wc.on('did-stop-loading', () => {
    loading[key] = false;
    broadcast();
  });
}

function getView(accountId, serviceId) {
  const key = viewKey(accountId, serviceId);
  if (views.has(key)) return views.get(key);
  configureSession(accountId);
  const view = new WebContentsView({
    webPreferences: { partition: partitionFor(accountId), sandbox: true, contextIsolation: true },
  });
  view.setBackgroundColor('#ffffff');
  view.setVisible(false);
  win.contentView.addChildView(view);
  wireWebContents(view.webContents, accountId, serviceId);
  view.webContents.loadURL(serviceById(serviceId).url);
  views.set(key, view);
  return view;
}

function activeView() {
  const a = config.active;
  return a ? views.get(viewKey(a.accountId, a.service)) : null;
}

function layoutViews() {
  const current = activeView();
  for (const view of views.values()) {
    const visible = view === current && !overlay && contentBounds.width > 0 && contentBounds.height > 0;
    if (visible) view.setBounds(contentBounds);
    view.setVisible(visible);
  }
}

function show(accountId, serviceId) {
  if (!findAccount(accountId) || !serviceById(serviceId)) return;
  getView(accountId, serviceId);
  config.active = { accountId, service: serviceId };
  saveConfig();
  layoutViews();
  broadcast();
}

function destroyAccountViews(accountId) {
  for (const service of SERVICES) {
    const key = viewKey(accountId, service.id);
    const view = views.get(key);
    if (!view) continue;
    win.contentView.removeChildView(view);
    view.webContents.close();
    views.delete(key);
    delete loading[key];
  }
}

// ------------------------------------------------------------- shortcuts ----

// Returns an action name for the key press, or null to let it through.
function shortcutFor(input) {
  const ctrl = input.control || input.meta;
  const key = input.key;
  if (ctrl && !input.alt && !input.shift && /^[1-9]$/.test(key)) return `account:${Number(key) - 1}`;
  if (input.alt && !ctrl && !input.shift && /^[1-3]$/.test(key)) return `service:${SERVICES[Number(key) - 1].id}`;
  if (ctrl && key === 'Tab') return input.shift ? 'account:prev' : 'account:next';
  if (ctrl && input.shift && key.toLowerCase() === 'k') return 'palette';
  if (key === 'F5' || (ctrl && !input.shift && key.toLowerCase() === 'r')) return 'reload';
  if (input.alt && key === 'ArrowLeft') return 'back';
  if (input.alt && key === 'ArrowRight') return 'forward';
  if (key === 'F12') return 'devtools';
  return null;
}

function runShortcut(action) {
  const accounts = config.accounts;
  const active = config.active;
  const service = active ? active.service : 'mail';
  const index = active ? accounts.findIndex((a) => a.id === active.accountId) : -1;

  if (action.startsWith('account:') && accounts.length) {
    const arg = action.slice('account:'.length);
    let next = index;
    if (arg === 'next') next = (index + 1) % accounts.length;
    else if (arg === 'prev') next = (index - 1 + accounts.length) % accounts.length;
    else next = Number(arg);
    if (accounts[next]) show(accounts[next].id, service);
  } else if (action.startsWith('service:') && active) {
    show(active.accountId, action.slice('service:'.length));
  } else if (action === 'reload') {
    activeView()?.webContents.reload();
  } else if (action === 'back') {
    activeView()?.webContents.navigationHistory.goBack();
  } else if (action === 'forward') {
    activeView()?.webContents.navigationHistory.goForward();
  } else if (action === 'devtools') {
    win.webContents.toggleDevTools();
  }
  // Every shortcut is also forwarded so the design can react (e.g. the palette).
  if (win && !win.isDestroyed()) win.webContents.send('shift:shortcut', action);
}

// ------------------------------------------------------------------- IPC ----

ipcMain.handle('shift:getState', () => snapshot());

ipcMain.handle('shift:show', (_e, accountId, serviceId) => show(accountId, serviceId));

ipcMain.handle('shift:addAccount', (_e, { label, color } = {}) => {
  const account = {
    id: crypto.randomUUID(),
    label: (label || '').trim() || `Account ${config.accounts.length + 1}`,
    email: null,
    color: color || PALETTE[config.accounts.length % PALETTE.length],
  };
  config.accounts.push(account);
  saveConfig();
  show(account.id, 'mail');
  return account;
});

ipcMain.handle('shift:updateAccount', (_e, id, patch = {}) => {
  const account = findAccount(id);
  if (!account) return null;
  if (typeof patch.label === 'string' && patch.label.trim()) account.label = patch.label.trim();
  if (typeof patch.color === 'string') account.color = patch.color;
  saveConfig();
  broadcast();
  return account;
});

ipcMain.handle('shift:removeAccount', async (_e, id) => {
  if (!findAccount(id)) return;
  destroyAccountViews(id);
  delete unread[id];
  config.accounts = config.accounts.filter((a) => a.id !== id);
  if (config.active?.accountId === id) {
    config.active = config.accounts.length ? { accountId: config.accounts[0].id, service: 'mail' } : null;
  }
  saveConfig();
  await session.fromPartition(partitionFor(id)).clearStorageData();
  if (config.active) show(config.active.accountId, config.active.service);
  else {
    layoutViews();
    broadcast();
  }
});

ipcMain.handle('shift:reorderAccounts', (_e, ids) => {
  const byId = new Map(config.accounts.map((a) => [a.id, a]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length !== config.accounts.length) return;
  config.accounts = ordered;
  saveConfig();
  broadcast();
});

ipcMain.on('shift:setContentBounds', (_e, rect) => {
  contentBounds = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  };
  layoutViews();
});

ipcMain.on('shift:setOverlay', (_e, open) => {
  overlay = Boolean(open);
  layoutViews();
});

ipcMain.on('shift:navigate', (_e, action) => {
  const view = activeView();
  if (!view) return;
  if (action === 'reload') view.webContents.reload();
  else if (action === 'back') view.webContents.navigationHistory.goBack();
  else if (action === 'forward') view.webContents.navigationHistory.goForward();
  else if (action === 'home') view.webContents.loadURL(serviceById(config.active.service).url);
});

// ---------------------------------------------------------------- window ----

function createWindow() {
  const options = loadWindowOptions();
  const saved = config.windowBounds || {};
  win = new BrowserWindow({
    width: saved.width || 1440,
    height: saved.height || 900,
    x: saved.x,
    y: saved.y,
    minWidth: options.minWidth || 800,
    minHeight: options.minHeight || 560,
    title: 'Shift',
    backgroundColor: options.backgroundColor || '#ffffff',
    autoHideMenuBar: true,
    ...(options.titleBarStyle ? { titleBarStyle: options.titleBarStyle } : {}),
    ...(options.titleBarOverlay ? { titleBarOverlay: options.titleBarOverlay } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (saved.maximized) win.maximize();

  attachShortcuts(win.webContents);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('close', () => {
    config.windowBounds = { ...win.getNormalBounds(), maximized: win.isMaximized() };
    saveConfig();
  });
  win.on('closed', () => {
    win = null;
    views.clear();
  });

  // Restore the last account/service once the chrome has reported its slot.
  win.webContents.once('did-finish-load', () => {
    const a = config.active;
    if (a && findAccount(a.accountId)) show(a.accountId, a.service);
  });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  if (!gotLock) return;
  Menu.setApplicationMenu(null);
  loadConfig();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
