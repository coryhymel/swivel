// electron-builder afterPack hook. Flips Electron fuses on the packaged Swivel.exe.
//
// electron-builder packs a fresh Electron binary, so the fuses that
// scripts/enable-fuses.mjs sets on node_modules/electron don't carry over.
//
// EnableCookieEncryption must match the dev build: both use %APPDATA%\Swivel, and
// a cookie store that was encrypted can't be read with the fuse off. The rest
// close ways to run code inside Swivel's process (ELECTRON_RUN_AS_NODE,
// NODE_OPTIONS, --inspect) or to swap the app code next to the exe.

const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
  console.log(`  • fuses flipped  file=${exe}`);
};
