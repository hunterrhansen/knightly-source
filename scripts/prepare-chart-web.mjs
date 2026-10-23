import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Resolve through Skia so its CanvasKit JS and WASM always have the same version.
const skiaRequire = createRequire(
  require.resolve('@shopify/react-native-skia/package.json'),
);
const source = skiaRequire.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
const destination = new URL('../public/canvaskit.wasm', import.meta.url);
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await copyFile(source, destination);
console.log('Prepared local CanvasKit asset for Expo web and Storybook.');
