import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// The lite single-threaded build: about 1.8 MB with its small network inside,
// and no cross-origin isolation needed. Served from the app's origin, it is
// loaded by the review's engine worker on first use, outside the bundle.
const root = dirname(require.resolve('stockfish/package.json'));
const destination = new URL('../public/stockfish/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const [from, to] of [
  ['bin/stockfish-19-lite-single.js', 'stockfish.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish.wasm'],
  ['Copying.txt', 'COPYING.txt'],
])
  await copyFile(join(root, from), new URL(to, destination));
console.log('Prepared the local Stockfish engine for Expo web and Storybook.');
