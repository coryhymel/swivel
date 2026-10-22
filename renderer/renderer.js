// Baseline chrome: account rail on the left, service switcher top right, the
// Google page in #content. Each design branch replaces this file.

const api = window.shift;
const accountsEl = document.getElementById('accounts');
const servicesEl = document.getElementById('services');
const contentEl = document.getElementById('content');
const addDialog = document.getElementById('add-account');

let state = null;

const initials = (label) =>
  label
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function render() {
  accountsEl.replaceChildren(
    ...state.accounts.map((account) => {
      const button = document.createElement('button');
      button.className = 'account';
      button.classList.toggle('active', account.id === state.active?.accountId);
      button.style.background = account.color;
      button.title = `${account.label}${account.email ? ` — ${account.email}` : ''}`;
      button.textContent = initials(account.label);
      const count = state.unread[account.id];
      if (count) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = count > 99 ? '99+' : count;
        button.append(badge);
      }
      button.onclick = () => api.show(account.id, state.active?.service || 'mail');
      return button;
    }),
    Object.assign(document.createElement('button'), {
      className: 'account add',
      textContent: '+',
      title: 'Add account',
      onclick: openAddDialog,
    }),
  );

  servicesEl.replaceChildren(
    ...state.services.map((service) => {
      const button = document.createElement('button');
      button.role = 'tab';
      button.textContent = service.name;
      button.setAttribute('aria-selected', String(service.id === state.active?.service));
      button.disabled = !state.active;
      button.onclick = () => api.show(state.active.accountId, service.id);
      return button;
    }),
  );
}

function openAddDialog() {
  // The native view would cover the dialog, so hide it while the dialog is up.
  api.setOverlay(true);
  addDialog.showModal();
}

addDialog.addEventListener('close', () => {
  api.setOverlay(false);
  const label = addDialog.querySelector('input').value;
  addDialog.querySelector('input').value = '';
  if (addDialog.returnValue === 'add') api.addAccount({ label });
});

function reportBounds() {
  const r = contentEl.getBoundingClientRect();
  // Inset by the border so the page sits inside the rounded frame.
  api.setContentBounds({ x: r.x + 1, y: r.y + 1, width: r.width - 2, height: r.height - 2 });
}

new ResizeObserver(reportBounds).observe(contentEl);
window.addEventListener('resize', reportBounds);

api.onState((next) => {
  state = next;
  render();
});

api.getState().then((initial) => {
  state = initial;
  render();
  reportBounds();
});
