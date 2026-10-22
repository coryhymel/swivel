# Design contract

Shift is split into **plumbing** (shared, on `main`) and **chrome** (per design).

| Layer | Files | Who changes it |
|---|---|---|
| Plumbing | `main.js`, `preload.js`, `renderer/mock-api.js` | `main` branch only |
| Chrome | everything else in `renderer/` | each design branch |

A design branch must not edit the plumbing files. If a design needs something the
API below can't do, say so in that branch's `DESIGN.md` under "Plumbing requests".

## How the window works

The renderer (`renderer/index.html`) draws the app chrome: account switcher,
service switcher, anything else. It must contain **one element that marks the
content slot**. The renderer measures it and calls `shift.setContentBounds(rect)`;
the main process then lays a native Chromium view (the real Gmail / Calendar /
Drive page) exactly over that rectangle.

Consequences:

- **Nothing in the HTML can be drawn on top of the content slot.** The native view
  always paints above the page. Menus, popovers, dialogs or palettes that overlap
  the slot must call `shift.setOverlay(true)` while open (this hides the native view)
  and `shift.setOverlay(false)` when closed. Prefer layouts where small menus stay
  inside the chrome.
- Report bounds on load, on window resize, and whenever the chrome changes size
  (a `ResizeObserver` on the slot covers this).
- Bounds are CSS pixels relative to the window's top-left corner.
- Rounded corners on the slot are not clipped onto the native view; inset the
  bounds a few pixels if the frame has a border or radius.

## API: `window.shift`

```js
shift.isPreview                  // true in a plain browser (mock), false in the app
await shift.getState()           // -> State
shift.onState(cb)                // cb(State) on every change; returns unsubscribe
shift.onShortcut(cb)             // cb(action) for every global shortcut; returns unsubscribe
await shift.show(accountId, serviceId)
await shift.addAccount({ label?, color? })   // creates, switches to it, opens Google sign-in
await shift.updateAccount(id, { label?, color? })
await shift.removeAccount(id)    // also wipes that account's saved login
await shift.reorderAccounts([id, ...])
shift.setContentBounds({ x, y, width, height })
shift.setOverlay(bool)
shift.navigate('back' | 'forward' | 'reload' | 'home')
```

```ts
State = {
  accounts: { id, label, email: string | null, color: '#rrggbb' }[]
  services: { id: 'mail' | 'calendar' | 'drive', name, url }[]
  palette:  string[]                       // suggested account colors
  active:   { accountId, service } | null  // null when there are no accounts
  unread:   { [accountId]: number }        // from Gmail's tab title
  loading:  { ['accountId:serviceId']: boolean }
}
```

`email` is filled in automatically once Gmail loads for that account.

## Global shortcuts

Handled in the main process, so they work even while focus is inside a Google page.
Switching is already done by the time `onShortcut` fires; the design only needs to
react to actions it owns (e.g. `palette`).

| Keys | Action |
|---|---|
| Ctrl+1 … Ctrl+9 | `account:<index>` |
| Ctrl+Tab / Ctrl+Shift+Tab | `account:next` / `account:prev` |
| Alt+1 / Alt+2 / Alt+3 | `service:mail` / `service:calendar` / `service:drive` |
| Ctrl+Shift+K | `palette` (design decides what it does) |
| F5 / Ctrl+R | `reload` |
| Alt+← / Alt+→ | `back` / `forward` |
| F12 | `devtools` (chrome DevTools) |

## Window options: `renderer/window.json` (optional)

```json
{
  "backgroundColor": "#1f1f1f",
  "minWidth": 800,
  "minHeight": 560,
  "titleBarStyle": "hidden",
  "titleBarOverlay": { "color": "#1f1f1f", "symbolColor": "#ffffff", "height": 40 }
}
```

With `titleBarStyle: "hidden"` the design draws its own title bar: mark draggable
areas with `-webkit-app-region: drag` (and `no-drag` on buttons inside them), and
leave room on the right for the native min/max/close buttons (about 140px).

## Constraints

- No external network resources in the chrome (CSP is `default-src 'self'`). No
  CDN fonts or scripts; use system fonts (`Segoe UI Variable`, `Segoe UI`,
  `system-ui`) and inline SVG.
- Plain HTML/CSS/JS, no build step. Don't declare a top-level `shift` variable in a
  classic script: it collides with the global `window.shift` and the script fails
  to load. Alias it (`const api = window.shift`) or wrap the script in a function.
- `renderer/mock-api.js` must stay loaded before your script so the design can be
  previewed by opening `renderer/index.html` in a browser.
  `?accounts=0` previews the first-run state, `?service=calendar` a different service.
- Brand marks: draw simple original glyphs for mail / calendar / drive rather than
  copying Google's logos.
