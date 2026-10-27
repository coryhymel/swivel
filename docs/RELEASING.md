# Releasing

Releases are built by GitHub Actions ([`.github/workflows/release.yml`](../.github/workflows/release.yml))
when a version tag is pushed. Installed copies of Swivel find the new release
through `electron-updater` and update themselves.

## Cut a release

1. Make sure `main` is green in CI.
2. Bump the version in `package.json` and `package-lock.json`:

   ```
   npm version 0.2.0 --no-git-tag-version
   ```

3. Move the `[Unreleased]` notes in [CHANGELOG.md](../CHANGELOG.md) under a new
   version heading and update the compare links at the bottom.
4. Commit, tag and push:

   ```
   git commit -am "Release 0.2.0"
   git tag v0.2.0
   git push origin main v0.2.0
   ```

5. The **Release** workflow builds the installer and attaches three files to
   a **draft** GitHub release:
   - `Swivel-Setup-0.2.0.exe`, the installer
   - `Swivel-Setup-0.2.0.exe.blockmap`, used for smaller incremental updates
   - `latest.yml`, which tells installed copies an update exists
6. Open the draft on the Releases page, paste in the changelog notes and
   **Publish**. Installed copies only see a release once it's published.

The tag must match `package.json` (`v` + version). electron-builder uploads to
the release for that version.

## How updates reach users

On startup, and every 6 hours after that, the installed app fetches
`latest.yml` from the latest published release. If the version is newer, it
downloads the installer in the background, shows a Windows notification, and
installs it the next time Swivel quits. Dev runs (`npm start`) never check.

You can only test auto-update end to end once two releases have been
published: install the older one, then publish the newer one.

## Building locally

```
npm run pack   # dist/win-unpacked/Swivel.exe, no installer (fast)
npm run dist   # dist/Swivel-Setup-<version>.exe
```

Local builds are never published. Publishing only happens in CI with
`--publish always`.

Check the security fuses on a build with:

```
npx @electron/fuses read --app dist/win-unpacked/Swivel.exe
```

`EnableCookieEncryption` must be **Enabled**.

## Code signing (not set up yet)

Releases are currently **unsigned**, so Windows SmartScreen warns on first
run. To sign them later, pick one of these:

- **Azure Trusted Signing** (cheapest for individuals): add an
  `azureSignOptions` block to `build.win` in `package.json` and put the Azure
  credentials (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`) in
  repository secrets. See electron-builder's
  [Windows code signing docs](https://www.electron.build/code-signing-win).
- **A .pfx certificate**: add the base64-encoded certificate as the `CSC_LINK`
  secret and its password as `CSC_KEY_PASSWORD`, then pass both as `env` to the
  build step in `release.yml`.

After signing is set up, add `publisherName` to `build.win` so
`electron-updater` checks that updates are signed by the same publisher.
