# Architecture

Swivel is a small Electron app with no framework and no build step. This page
explains how the pieces fit together, the API between the UI and the main
process, and the security model. Read it before you change `main.js` or
`preload.js`.

## Files

| File | Process | What it does |
|---|---|---|
| `main.js` | main | Accounts, sessions, the native Google views, shortcuts, IPC, auto-update |
| `preload.js` | renderer (isolated) | Exposes `window.swivel`, the only API the UI has |
| `renderer/index.html`, `renderer.js`, `styles.css` | renderer | The app chrome: account rail, top bar, dialogs |
| `renderer/mock-api.js` | browser only | A fake `window.swivel` so the UI can be opened in a normal browser |
| `renderer/window.json` | main (optional) | Window frame options the UI can set without touching `main.js` |
| `scripts/enable-fuses.mjs` | `npm install` | Turns on cookie encryption for the dev Electron binary |
| `scripts/after-pack.cjs` | `electron-builder` | Sets the security fuses on the packaged `Swivel.exe` |
| `scripts/make-icons.mjs` | manual | Renders `build/icon.svg` to `.png` and `.ico` |

There are two layers:

- **Plumbing**: `main.js`, `preload.js` and `renderer/mock-api.js`. Changes here
  affect security and every UI, so they get extra review. Keep `mock-api.js` in
  step with `preload.js`.
- **Chrome**: the rest of `renderer/`. You can restyle or rebuild it freely, as
  long as it only talks to the main process through `window.swivel`.

## How the window works

```
┌──────────── BrowserWindow (renderer/index.html) ────────────┐
│ rail │ top bar: account · back/reload · Gmail|Calendar|Drive│
│  ●   ├──────────────────────────────────────────────────────┤
│  ●   │                                                      │
│  ●   │   content slot  ◄── a WebContentsView is laid over   │
│  +   │                     this rectangle by main.js        │
│      │                                                      │
└──────┴──────────────────────────────────────────────────────┘
```

- Every account gets its own persistent session partition,
  `persist:account-<uuid>`, so accounts never share cookies and sign-ins
  survive restarts.
- Every (account, service) pair gets one `WebContentsView`, created on first
  use and then kept alive. Switching back to it is instant and doesn't reload
  Gmail.
- The renderer marks one element as the **content slot**, measures it and calls
  `swivel.setContentBounds(rect)`. The main process places the active view
  exactly over that rectangle and hides all the others.

Consequences for UI work:

- **Nothing in the HTML can be drawn over the content slot.** The native view
  always paints on top. Menus, dialogs or popovers that overlap the slot must
  call `swivel.setOverlay(true)` while open (this hides the native view) and
  `swivel.setOverlay(false)` when they close.
- Report bounds on load, on window resize, and whenever the chrome changes size.
  A `ResizeObserver` on the slot covers all three.
- Bounds are in CSS pixels, relative to the window's top-left corner.
- Rounded corners on the slot aren't applied to the native view. Inset the
  bounds a few pixels if the frame has a border or radius.

## API: `window.swivel`

```js
swivel.isPreview                  // true in a plain browser (mock), false in the app
await swivel.getState()           // -> State
swivel.onState(cb)                // cb(State) on every change; returns unsubscribe
swivel.onShortcut(cb)             // cb(action) for every global shortcut; returns unsubscribe
await swivel.show(accountId, serviceId)
await swivel.addAccount({ label?, color? })   // creates, switches to it, opens Google sign-in
await swivel.updateAccount(id, { label?, color? })
await swivel.removeAccount(id)    // also wipes that account's saved login
await swivel.reorderAccounts([id, ...])
swivel.setContentBounds({ x, y, width, height })
swivel.setOverlay(bool)
swivel.navigate('back' | 'forward' | 'reload' | 'home')
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

`email` and `unread` come from Gmail's tab title
(`Inbox (12) - someone@example.com - Gmail`), so they show up once Gmail has
loaded for that account.

Configuration (accounts, last active view, window bounds) lives in
`%APPDATA%\Swivel\swivel-config.json`. Session data lives under
`%APPDATA%\Swivel\Partitions`.

## Keyboard shortcuts

The main process handles these through `before-input-event` on every
webContents, so they work even while focus is inside a Google page. The switch
has already happened by the time `onShortcut` fires; the UI only needs to react
to actions it owns, such as `palette`.

| Keys | Action |
|---|---|
| Ctrl+1 … Ctrl+9 | `account:<index>` |
| Ctrl+Tab / Ctrl+Shift+Tab | `account:next` / `account:prev` |
| Alt+1 / Alt+2 / Alt+3 | `service:mail` / `service:calendar` / `service:drive` |
| Ctrl+Shift+K | `palette` (opens the Add account dialog) |
| F5 / Ctrl+R | `reload` |
| Alt+← / Alt+→ | `back` / `forward` |
| F12 | `devtools` (DevTools for Swivel's own UI) |

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

With `titleBarStyle: "hidden"` the UI draws its own title bar. Mark draggable
areas with `-webkit-app-region: drag` (and `no-drag` on buttons inside them),
and leave about 140px on the right for the native minimize, maximize and close
buttons.

## Renderer constraints

- No external network resources in the chrome. The CSP is `default-src 'self'`,
  so no CDN fonts or scripts. Use system fonts (`Segoe UI Variable`,
  `Segoe UI`, `system-ui`) and inline SVG.
- Plain HTML, CSS and JS with no build step. Don't declare a top-level `swivel`
  variable in a classic script: it collides with the global `window.swivel` and
  the script fails to load. Alias it (`const api = window.swivel`) or wrap the
  script in a function.
- `renderer/mock-api.js` must load before `renderer.js`, so the UI can be
  previewed by opening `renderer/index.html` in a browser. `?accounts=0` shows
  the first-run state; `?service=calendar` shows a different service.
- Draw simple original glyphs for mail, calendar and drive; don't copy
  Google's logos.

## Security model

Swivel holds live Google sessions for several accounts, so the main process is
deliberately strict. Any change that loosens one of these rules needs a stated
reason in the pull request.

- **Isolation.** Google pages run with `sandbox: true` and `contextIsolation: true`
  and have **no preload**, so they can't reach IPC. Each account's cookies live in
  their own partition.
- **IPC sender check.** Every IPC handler goes through `fromSwivelUi()`, which
  only accepts messages from the top frame of the app window while it shows
  `renderer/index.html`. Arguments are validated (colors, label length, bounds).
- **App window stays on Swivel's UI.** `will-navigate` is blocked and
  `window.open` is denied for the app window, so a link or file dropped on it
  can't replace the UI.
- **Permissions.** Electron grants every permission by default. Swivel denies
  all of them except a short list: notifications, clipboard, and fullscreen for
  Google hosts over HTTPS, plus camera and microphone for `meet.google.com`
  only. See `PERMISSIONS` in `main.js`.
- **Links and pop-ups.** Gmail and Calendar keep only their own pop-ups
  (compose, print) and sign-in inside Swivel; every other link, Google's
  included, opens in the default browser. Drive keeps Google pop-ups (Docs) in
  a Swivel window signed in to the same account. Gmail's
  `google.com/url?q=` redirects are unwrapped first. See `staysInApp()` and
  `guardPopups()`.
- **User agent.** Swivel identifies as the Chrome version Electron is built on,
  with the `Electron/x` token removed. On `accounts.google.com` it sends a
  versionless Chrome UA, the approach Ferdium uses, because Google's sign-in
  rejects embedded browsers. The UA is changed only after a navigation commits
  (`did-navigate`); changing it mid-navigation makes Electron restart the
  navigation.
- **Cookie encryption.** Electron stores cookies in plain text unless the
  `EnableCookieEncryption` fuse is on. Swivel turns it on for both the dev
  binary (`scripts/enable-fuses.mjs`, run on `npm install`) and the packaged app
  (`scripts/after-pack.cjs`), so cookies are encrypted with Windows DPAPI the
  way Chrome and Edge do it. The fuse can't be turned off again for an existing
  profile.
- **Packaged-app fuses.** Release builds also disable `RunAsNode`,
  `NODE_OPTIONS` and `--inspect`, only load the app from `app.asar`, and check
  the asar's integrity at startup.
- **Updates.** Installed builds check GitHub Releases through
  `electron-updater`. Dev runs never do.
