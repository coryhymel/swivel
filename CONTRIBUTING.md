# Contributing to Swivel

Thanks for helping out! Swivel is a small, deliberately simple app. These notes
should get you from clone to pull request quickly.

## Ground rules

- **Be kind.** This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Open an issue first for anything big.** A new feature, a new dependency or
  a UI redesign is easier to discuss before code exists.
- **Security problems go to [SECURITY.md](SECURITY.md)**, not public issues.

## Setup

You need **Windows 10 or 11**, **Node.js 20+** and Git.

```
git clone https://github.com/coryhymel/swivel.git
cd swivel
npm install      # also turns on cookie encryption for the dev Electron binary
npm start
```

`npm start` uses the same profile folder as the installed app
(`%APPDATA%\Swivel`), so your accounts and sign-ins are shared between the two.
Quit the installed Swivel first: only one copy can run at a time.

## Project layout

```
main.js              main process: accounts, sessions, views, shortcuts, IPC, updates
preload.js           exposes window.swivel to the UI
renderer/            the app chrome (plain HTML/CSS/JS, no build step)
  mock-api.js        fake window.swivel for previewing the UI in a browser
build/               icon source and generated icons
scripts/             fuse, packaging and icon scripts
docs/                architecture, design and release notes
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing `main.js`
or `preload.js`. It explains the content-slot model, the `window.swivel` API and
the security model.

## Working on the UI

Open `renderer/index.html` directly in a browser. `mock-api.js` fills in sample
accounts and paints a placeholder where Gmail would be, so you can iterate on
the chrome without signing in to anything.

- `renderer/index.html?accounts=0` shows the first-run state
- `renderer/index.html?service=calendar` starts on another service

The UI must only talk to the app through `window.swivel`. If it needs something
the API can't do, add it to `preload.js`, `main.js` **and** `mock-api.js`
together.

## Rules of thumb

- **Stay small.** No frameworks or bundlers for the renderer, and as few
  runtime dependencies as possible. Every dependency ends up inside a Google
  session wrapper.
- **Security changes need a reason.** If a PR grants a new permission, keeps a
  new host inside the app, loosens the IPC check or changes the user agent,
  explain why in the description.
- **Don't automate Google sign-in.** Never script sign-in attempts against a
  real Google account, not even to test the user agent. Google risk-scores
  repeated automated sign-ins and starts blocking that account *and* the
  machine, which breaks real sign-in too. Check sign-in mechanics without
  submitting credentials (the page loads, the UA is right), then try one real
  sign-in by hand.
- **Match the existing style.** Two-space indent, single quotes, short comments
  that explain *why*.

## Checks

```
npm run check    # syntax check for all scripts
npm run pack     # build dist/win-unpacked/Swivel.exe and set the fuses
```

There's no automated test suite yet. Before opening a PR, run the app and check
what you changed by hand: switching accounts and services, adding and removing
an account, and opening a link from Gmail. CI runs `check` and `pack` on every
push and pull request.

## Pull requests

1. Fork, then branch from `main`.
2. Keep each PR to one change; small PRs get reviewed faster.
3. Add a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for
   anything a user would notice.
4. Fill in the PR template, with screenshots for UI changes.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
