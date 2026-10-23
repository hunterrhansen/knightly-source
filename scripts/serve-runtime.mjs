import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { startLoggedProcess } from './runtime-process.mjs';

const kind = process.argv[2];
if (
  !['storybook', 'production'].includes(kind) ||
  !process.env.RUNTIME_DIRECTORY
)
  throw new Error('Run through npm run test:runtime or npm run test:board.');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = process.env.RUNTIME_DIRECTORY;
const output = join(directory, kind);
const port = Number(
  kind === 'storybook'
    ? process.env.RUNTIME_PORT
    : process.env.RUNTIME_PRODUCTION_PORT,
);
const controller = new AbortController();
let server;
const shutdown = () => {
  controller.abort();
  server?.httpServer.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
const args =
  kind === 'storybook'
    ? [
        'node_modules/storybook/dist/bin/dispatcher.js',
        'build',
        '--disable-telemetry',
        '--output-dir',
        output,
      ]
    : [
        'node_modules/expo/bin/cli',
        'export',
        '--platform',
        'web',
        '--output-dir',
        output,
      ];
const code = await startLoggedProcess(process.execPath, args, {
  root,
  log: join(directory, `${kind}-build.log`),
  signal: controller.signal,
  timeoutMs: 240_000,
}).done;
if (code !== 0 || controller.signal.aborted) process.exitCode = code || 1;
else {
  server = await preview({
    configFile: false,
    root,
    build: { outDir: output },
    preview: { host: '127.0.0.1', port, strictPort: true, open: false },
  });
  console.log(`${kind} ready at http://127.0.0.1:${port}`);
  writeFileSync(
    join(directory, `${kind}-ready.json`),
    JSON.stringify({
      token: process.env.RUNTIME_RUN_TOKEN,
      port,
      pid: process.pid,
    }),
  );
  if (controller.signal.aborted) server.httpServer.close();
}
