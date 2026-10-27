// Renders build/icon.svg to the icons electron-builder uses:
// build/icon.png (512px) and build/icon.ico (16 to 256px).
// Run `npm run icons` after editing the SVG and commit the results.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const buildDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
const svg = await fs.readFile(path.join(buildDir, 'icon.svg'));
const render = (size) => sharp(svg, { density: 72 * (size / 256) * 4 }).resize(size, size).png().toBuffer();

await fs.writeFile(path.join(buildDir, 'icon.png'), await render(512));
const sizes = [16, 24, 32, 48, 64, 128, 256];
await fs.writeFile(path.join(buildDir, 'icon.ico'), await pngToIco(await Promise.all(sizes.map(render))));
console.log(`Wrote build/icon.png and build/icon.ico (${sizes.join(', ')}px)`);
