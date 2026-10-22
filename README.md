# Shift

A Windows desktop app for switching quickly between Gmail, Google Calendar and
Google Drive across several Google accounts, in one window.

## Run

```
npm install
npm start
```

Click **+** to add an account, then sign in to Google in the page that opens.

## How it works

- **Electron.** Each Google account gets its own persistent session partition
  (`persist:account-<id>`), so sign-ins survive restarts and accounts never share
  cookies. The partitions live under `%APPDATA%\Shift\Partitions`.
- One native view per (account, service) is created on first use and kept alive,
  so switching back is instant and doesn't reload Gmail.
- The user agent is plain Chrome (the `Electron/x` token is stripped), which
  Google requires for sign-in.
- Unread counts and the account's email address come from Gmail's tab title.
- Links to non-Google sites open in your default browser; Google pop-ups (Docs,
  Meet, attachments) open in a Shift window signed in to the same account.

See [DESIGN_CONTRACT.md](DESIGN_CONTRACT.md) for how the UI layer (`renderer/`)
talks to the main process, and the keyboard shortcuts.

## UI

The chrome is design A, "Classic" (see [DESIGN.md](DESIGN.md)). Open
`renderer/index.html` in a browser to preview it with sample accounts.
Two other candidates were explored and are kept on the `design/b-rail` and
`design/c-command` branches.
