// Runs after `npm install`. Flips Electron fuses on the local Electron binary.
//
// EnableCookieEncryption: Electron stores cookies in plaintext by default, which
// would leave every account's Google session tokens readable by any program
// running as this user. With the fuse on, cookies are encrypted with Windows
// DPAPI like Chrome and Edge do. One-way: turning it off later corrupts the store.

import { createRequire } from 'node:module';
import { flipFuses, getCurrentFuseWire, FuseState, FuseVersion, FuseV1Options } from '@electron/fuses';

const electronBinary = createRequire(import.meta.url)('electron'); // path to electron.exe

await flipFuses(electronBinary, {
  version: FuseVersion.V1,
  [FuseV1Options.EnableCookieEncryption]: true,
});

const wire = await getCurrentFuseWire(electronBinary);
console.log(`Electron fuses: EnableCookieEncryption=${wire[FuseV1Options.EnableCookieEncryption] === FuseState.ENABLE ? 'on' : 'OFF'}`);
