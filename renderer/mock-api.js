// Stand-in for window.shift when renderer/index.html is opened in a normal
// browser (no Electron). Lets a design be previewed and screenshotted with
// sample accounts. The content slot is painted with a placeholder instead of a
// real Google page. Load this before renderer.js.

(function () {
  if (window.shift) return;

  const services = [
    { id: 'mail', name: 'Gmail', url: 'https://mail.google.com/mail/u/0/' },
    { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com/calendar/u/0/r' },
    { id: 'drive', name: 'Drive', url: 'https://drive.google.com/drive/u/0/my-drive' },
  ];
  const palette = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#b31412', '#5f6368'];

  // ?accounts=0 previews the empty / first-run state.
  const params = new URLSearchParams(location.search);
  const sample = [
    { id: 'work', label: 'Work', email: 'cory.hymel@andela.com', color: '#1a73e8' },
    { id: 'personal', label: 'Personal', email: 'cory.hymel@gmail.com', color: '#188038' },
    { id: 'side', label: 'Side project', email: 'hello@shift.dev', color: '#e37400' },
  ].slice(0, params.has('accounts') ? Number(params.get('accounts')) : 3);

  const state = {
    accounts: sample,
    services,
    palette,
    active: sample.length ? { accountId: sample[0].id, service: params.get('service') || 'mail' } : null,
    unread: { work: 12, personal: 3, side: 0 },
    loading: {},
  };

  const stateListeners = new Set();
  const shortcutListeners = new Set();
  let overlay = false;
  let bounds = null;

  const emit = () => {
    paint();
    stateListeners.forEach((cb) => cb(structuredClone(state)));
  };

  // Paints a fake page where the native WebContentsView would sit.
  function paint() {
    let el = document.getElementById('__shift-mock-view');
    if (!el) {
      el = document.createElement('div');
      el.id = '__shift-mock-view';
      Object.assign(el.style, {
        position: 'fixed',
        zIndex: '1',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '6px',
        font: '14px system-ui, sans-serif',
        color: '#5f6368',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    const account = state.accounts.find((a) => a.id === state.active?.accountId);
    const service = services.find((s) => s.id === state.active?.service);
    const visible = bounds && account && service && !overlay && bounds.width > 0;
    el.style.display = visible ? 'flex' : 'none';
    if (!visible) return;
    Object.assign(el.style, {
      left: `${bounds.x}px`,
      top: `${bounds.y}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      borderTop: `3px solid ${account.color}`,
      boxSizing: 'border-box',
    });
    el.innerHTML = `<strong style="font-size:18px;color:#202124">${service.name}</strong>
      <span>${account.label} · ${account.email ?? 'not signed in'}</span>
      <span style="font-size:12px">(live Google page renders here in the app)</span>`;
  }

  window.shift = {
    isPreview: true,
    getState: async () => structuredClone(state),
    onState: (cb) => (stateListeners.add(cb), () => stateListeners.delete(cb)),
    onShortcut: (cb) => (shortcutListeners.add(cb), () => shortcutListeners.delete(cb)),
    show: async (accountId, service) => {
      state.active = { accountId, service };
      emit();
    },
    addAccount: async ({ label, color } = {}) => {
      const account = {
        id: `acct-${Date.now()}`,
        label: label || `Account ${state.accounts.length + 1}`,
        email: null,
        color: color || palette[state.accounts.length % palette.length],
      };
      state.accounts.push(account);
      state.active = { accountId: account.id, service: 'mail' };
      emit();
      return account;
    },
    updateAccount: async (id, patch) => {
      Object.assign(state.accounts.find((a) => a.id === id) || {}, patch);
      emit();
    },
    removeAccount: async (id) => {
      state.accounts = state.accounts.filter((a) => a.id !== id);
      if (state.active?.accountId === id) {
        state.active = state.accounts.length ? { accountId: state.accounts[0].id, service: 'mail' } : null;
      }
      emit();
    },
    reorderAccounts: async (ids) => {
      state.accounts = ids.map((id) => state.accounts.find((a) => a.id === id)).filter(Boolean);
      emit();
    },
    setContentBounds: (rect) => {
      bounds = rect;
      paint();
    },
    setOverlay: (open) => {
      overlay = Boolean(open);
      paint();
    },
    navigate: () => {},
  };

  // Mirror the main-process shortcuts so previews behave like the app.
  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    let action = null;
    if (ctrl && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) action = `account:${Number(e.key) - 1}`;
    else if (e.altKey && !ctrl && /^[1-3]$/.test(e.key)) action = `service:${services[Number(e.key) - 1].id}`;
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'k') action = 'palette';
    if (!action) return;
    e.preventDefault();
    const index = state.accounts.findIndex((a) => a.id === state.active?.accountId);
    if (action.startsWith('account:')) {
      const target = state.accounts[Number(action.slice(8))];
      if (target) window.shift.show(target.id, state.active?.service || 'mail');
    } else if (action.startsWith('service:') && index >= 0) {
      window.shift.show(state.active.accountId, action.slice(8));
    }
    shortcutListeners.forEach((cb) => cb(action));
  });
})();
