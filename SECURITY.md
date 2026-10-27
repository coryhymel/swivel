# Security policy

Swivel keeps signed-in Google sessions for several accounts on your PC, so
security reports are taken seriously.

## Supported versions

Only the latest release gets security fixes. Installed copies update
themselves, so the fix reaches users through the normal update.

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report it privately through GitHub instead:
[**Report a vulnerability**](https://github.com/coryhymel/swivel/security/advisories/new)
(the Security tab → "Report a vulnerability").

Please include:

- the Swivel version and Windows version,
- what an attacker can do, and what they need first (a malicious web page, a
  link in an email, local access, and so on),
- steps to reproduce, or a proof of concept.

You should get a reply within a week. Once a fix ships, you'll be credited in
the release notes unless you'd rather not be.

## In scope

- Reading or stealing another account's cookies or session data.
- A web page (a Google page, or anything a link opens) reaching Swivel's IPC,
  Node.js or the file system.
- Bypassing the permission allowlist (camera, microphone, notifications and so on).
- A link or pop-up that should open in the default browser loading inside
  Swivel instead, or one that navigates the app window away from Swivel's UI.
- Problems with the installer or the auto-update channel.

## Out of scope

- Attacks that need someone already running code as your Windows user. They can
  read any app's data, including Chrome's.
- Google's own services and sign-in decisions.
- Reports from automated scanners with no demonstrated impact.

The security model is described in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model).
