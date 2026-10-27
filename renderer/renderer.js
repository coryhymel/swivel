// Design A, Classic: account rail on the left, identity + service switcher on
// top, the Google page inside a rounded card.
(function () {
  const api = window.swivel;
  const $ = (id) => document.getElementById(id);
  const accountsEl = $('accounts');
  const servicesEl = $('services');
  const identityEl = $('identity');
  const contentEl = $('content');
  const cardEl = $('card');
  const welcomeEl = $('welcome');
  const dlg = $('dlg');

  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7.5l8 6 8-6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    drive: '<path d="M3 17.5V8a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11.5l3 4.5H9z"/>',
  };
  function icon(id) {
    const s = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({
      viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })) s.setAttribute(k, v);
    s.innerHTML = ICONS[id] || '';
    return s;
  }
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };

  const initials = (label) =>
    (label || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const SHORT = { mail: 'Alt+1', calendar: 'Alt+2', drive: 'Alt+3' };

  let state = null;
  let dialogMode = null; // { type: 'add' } | { type: 'edit', id }
  let pickedColor = null;
  let lastFocus = null;

  function render() {
    const { accounts, active } = state;
    const current = accounts.find((a) => a.id === active?.accountId) || null;
    document.documentElement.style.setProperty('--acc', current ? current.color : '#c4c8ce');
    cardEl.classList.toggle('empty', !current);
    welcomeEl.hidden = !!current;
    contentEl.hidden = !current;

    accountsEl.replaceChildren(
      ...accounts.map((a, i) => {
        const on = a.id === active?.accountId;
        const b = el('button', { className: 'account' + (on ? ' active' : ''), type: 'button' });
        b.style.background = a.color;
        b.style.setProperty('--c', a.color);
        b.append(initials(a.label));
        const hint = i < 9 ? ` (Ctrl+${i + 1})` : '';
        const n = state.unread[a.id];
        b.title = `${a.label}${a.email ? ' — ' + a.email : ''}${hint}\nRight-click to edit`;
        b.setAttribute('aria-label', `${a.label}${a.email ? ', ' + a.email : ''}${n ? `, ${n} unread` : ''}${on ? ', current account' : ''}`);
        b.setAttribute('aria-current', on ? 'true' : 'false');
        if (n) {
          const badge = el('span', { className: 'badge', textContent: n > 99 ? '99+' : String(n) });
          badge.setAttribute('aria-hidden', 'true');
          b.append(badge);
        }
        b.onclick = () => api.show(a.id, active?.service || 'mail');
        b.oncontextmenu = (e) => { e.preventDefault(); openEdit(a.id); };
        return b;
      }),
    );

    identityEl.replaceChildren();
    if (current) {
      const more = el('button', { className: 'icon-btn', type: 'button', title: 'Edit this account' });
      more.setAttribute('aria-label', `Edit account ${current.label}`);
      more.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
      more.onclick = () => openEdit(current.id);
      identityEl.append(
        el('span', { className: 'dot' }),
        el('span', { className: 'id-text' },
          el('span', { className: 'id-label', textContent: current.label }),
          el('span', { className: 'id-email', textContent: current.email || 'signing in…' })),
        more,
      );
    } else {
      identityEl.append(el('span', { className: 'id-email', textContent: 'No account selected' }));
    }

    servicesEl.replaceChildren(
      ...state.services.map((s) => {
        const on = s.id === active?.service;
        const b = el('button', { type: 'button' });
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(on));
        b.disabled = !current;
        b.title = `${s.name}${SHORT[s.id] ? ' (' + SHORT[s.id] + ')' : ''}`;
        b.append(icon(s.id), s.name);
        b.onclick = () => api.show(active.accountId, s.id);
        return b;
      }),
    );
    for (const id of ['back-btn', 'reload-btn']) $(id).disabled = !current;

    const busy = active && state.loading[`${active.accountId}:${active.service}`];
    cardEl.classList.toggle('loading', !!busy);
    // Report now (the slot may have just been unhidden) and again after paint;
    // rAF alone never fires while the window isn't being painted.
    reportBounds();
    requestAnimationFrame(reportBounds);
  }

  // ---- dialogs ----
  function buildSwatches() {
    const box = $('dlg-colors');
    const colors = [...new Set([...(state.palette || []), ...(pickedColor ? [pickedColor] : [])])];
    box.replaceChildren(
      ...colors.map((c) => {
        const b = el('button', { type: 'button' });
        b.style.setProperty('--c', c);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', c);
        b.setAttribute('aria-checked', String(c.toLowerCase() === (pickedColor || '').toLowerCase()));
        b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        b.onclick = () => { pickedColor = c; buildSwatches(); box.querySelector('[aria-checked="true"]').focus(); };
        return b;
      }),
    );
  }
  function openDialog() {
    lastFocus = document.activeElement;
    api.setOverlay(true);
    $('dlg-form').hidden = false;
    $('dlg-confirm').hidden = true;
    dlg.showModal();
  }
  function openAdd() {
    if (dlg.open) return;
    dialogMode = { type: 'add' };
    $('dlg-title').textContent = 'Add a Google account';
    $('dlg-note').textContent = 'Give it a label you will recognize. Google sign-in opens next.';
    $('dlg-note').hidden = false;
    $('dlg-label').value = '';
    $('dlg-ok').textContent = 'Add & sign in';
    $('dlg-remove').hidden = true;
    const used = new Set(state.accounts.map((a) => a.color.toLowerCase()));
    pickedColor = state.palette.find((c) => !used.has(c.toLowerCase())) || state.palette[0];
    buildSwatches();
    openDialog();
    $('dlg-label').focus();
  }
  function openEdit(id) {
    if (dlg.open) return;
    const a = state.accounts.find((x) => x.id === id);
    if (!a) return;
    dialogMode = { type: 'edit', id };
    $('dlg-title').textContent = 'Edit account';
    $('dlg-note').textContent = a.email || '';
    $('dlg-note').hidden = !a.email;
    $('dlg-label').value = a.label;
    $('dlg-ok').textContent = 'Save';
    $('dlg-remove').hidden = false;
    pickedColor = a.color;
    buildSwatches();
    openDialog();
    $('dlg-label').select();
  }
  $('dlg-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = $('dlg-label').value.trim();
    if (!label) { $('dlg-label').focus(); return; }
    if (dialogMode.type === 'add') api.addAccount({ label, color: pickedColor });
    else api.updateAccount(dialogMode.id, { label, color: pickedColor });
    dlg.close();
  });
  $('dlg-cancel').onclick = () => dlg.close();
  $('dlg-remove').onclick = () => {
    const a = state.accounts.find((x) => x.id === dialogMode.id);
    $('confirm-name').textContent = a.label;
    $('confirm-email').textContent = a.email || a.label;
    $('dlg-form').hidden = true;
    $('dlg-confirm').hidden = false;
    $('confirm-cancel').focus();
  };
  $('confirm-cancel').onclick = () => dlg.close();
  $('confirm-ok').onclick = () => { api.removeAccount(dialogMode.id); dlg.close(); };
  dlg.addEventListener('close', () => {
    api.setOverlay(false);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  $('add-btn').onclick = openAdd;
  $('welcome-add').onclick = openAdd;
  $('back-btn').onclick = () => api.navigate('back');
  $('reload-btn').onclick = () => api.navigate('reload');

  // ---- bounds ----
  function reportBounds() {
    if (contentEl.hidden) return;
    const r = contentEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    api.setContentBounds({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
  }
  new ResizeObserver(reportBounds).observe(contentEl);
  window.addEventListener('resize', reportBounds);

  api.onShortcut((action) => { if (action === 'palette' && !dlg.open) openAdd(); });
  api.onState((next) => { state = next; render(); });
  api.getState().then((s) => { state = s; render(); reportBounds(); });
})();
