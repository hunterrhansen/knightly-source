import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  evidenceDirectory,
  revision,
  saveEvidence,
} from './runtime-evidence.mjs';
import { startLoggedProcess } from './runtime-process.mjs';

export function parseRuntimeOptions(args) {
  const options = { port: 0, productionPort: 0, boardOnly: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--board-only') options.boardOnly = true;
    else if (argument === '--port' || argument === '--production-port') {
      const value = args[++index];
      if (!/^\d+$/.test(value ?? '') || Number(value) > 65535)
        throw new Error(
          `${argument} must be a port from 0 to 65535 (0 selects a free port).`,
        );
      options[argument === '--port' ? 'port' : 'productionPort'] =
        Number(value);
    } else
      throw new Error(
        `Unknown argument ${argument}. Use --port, --production-port or --board-only.`,
      );
  }
  if (options.port && options.port === options.productionPort)
    throw new Error('Storybook and production ports must be different.');
  return options;
}

// Reservation is released before Playwright launches. strictPort rejects a race;
// an existing listener is never reused or terminated.
export async function availablePort(requested = 0) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(requested, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function waitForRuntimeReady(
  url,
  run,
  signal,
  timeoutMs = 300_000,
  ownedReady = () => true,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted)
      throw signal.reason ?? new Error('Runtime startup interrupted.');
    if (run.child.exitCode !== null || run.child.signalCode !== null)
      throw new Error(`Runtime server exited before becoming ready: ${url}`);
    try {
      if (!ownedReady()) {
        await delay(100);
        continue;
      }
      const response = await fetch(url, {
        signal: AbortSignal.any([
          AbortSignal.timeout(1000),
          ...(signal ? [signal] : []),
        ]),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      /* Wait for this run's build and server, not a fixed sleep. */
    }
    await delay(100);
  }
  throw new Error(
    `Runtime server readiness timed out after ${timeoutMs} ms: ${url}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = evidenceDirectory(root, 'runtime');
  const controller = new AbortController();
  const evidence = {
    startedAt: new Date().toISOString(),
    node: process.version,
    status: 'running',
  };
  let code = 1;
  const servers = [];
  let closingServers = false;
  let interrupted = false;
  let overallTimeout;
  const interrupt = () => {
    interrupted = true;
    controller.abort(new Error('Runtime verification interrupted.'));
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const options = parseRuntimeOptions(process.argv.slice(2));
    code = await startLoggedProcess(
      process.execPath,
      ['scripts/check-environment.mjs'],
      {
        root,
        log: join(directory, 'environment.log'),
        signal: controller.signal,
      },
    ).done;
    if (code !== 0)
      throw new Error(
        'Environment preflight failed. Use the pinned Node/npm versions.',
      );
    evidence.revision = revision(root);
    const port = await availablePort(options.port);
    let productionPort = options.boardOnly
      ? 0
      : await availablePort(options.productionPort);
    while (productionPort === port) productionPort = await availablePort();
    let appPort = options.boardOnly ? 0 : await availablePort();
    while (appPort && [port, productionPort].includes(appPort))
      appPort = await availablePort();
    evidence.ports = {
      storybook: port,
      production: productionPort || null,
      app: appPort || null,
    };
    evidence.scope = options.boardOnly
      ? 'board input and promotion smoke'
      : 'board, app navigation and production smoke';
    saveEvidence(directory, evidence);
    const env = {
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      RUNTIME_DIRECTORY: directory,
      RUNTIME_PORT: String(port),
      RUNTIME_PRODUCTION_PORT: String(productionPort),
      RUNTIME_APP_PORT: String(appPort),
      EXPO_PUBLIC_API_URL: 'http://127.0.0.1:0',
      RUNTIME_PRODUCTION: options.boardOnly ? '0' : '1',
      RUNTIME_RUN_TOKEN: randomUUID(),
    };
    overallTimeout = setTimeout(
      () =>
        controller.abort(
          new Error('Runtime verification timed out after 600000 ms.'),
        ),
      600_000,
    );
    overallTimeout.unref();
    for (const [kind, readyURL] of [
      ['storybook', `http://127.0.0.1:${port}/index.json`],
      ...(!options.boardOnly
        ? [['production', `http://127.0.0.1:${productionPort}/index.html`]]
        : []),
    ]) {
      const run = startLoggedProcess(
        process.execPath,
        ['scripts/serve-runtime.mjs', kind],
        {
          root,
          env,
          log: join(directory, `${kind}-server.log`),
          signal: controller.signal,
          timeoutMs: 600_000,
          graceMs: 3000,
        },
      );
      servers.push(run);
      run.child.once('exit', (status, signal) => {
        if (!closingServers)
          controller.abort(
            new Error(
              `${kind} server exited unexpectedly (${status ?? signal}). See ${kind}-server.log.`,
            ),
          );
      });
      await waitForRuntimeReady(
        readyURL,
        run,
        controller.signal,
        300_000,
        () => {
          try {
            return (
              JSON.parse(
                readFileSync(join(directory, `${kind}-ready.json`), 'utf8'),
              ).token === env.RUNTIME_RUN_TOKEN
            );
          } catch (error) {
            if (error.code === 'ENOENT') return false;
            throw error;
          }
        },
      );
    }
    code = await startLoggedProcess(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test'],
      {
        root,
        env,
        log: join(directory, 'playwright.log'),
        signal: controller.signal,
        timeoutMs: 600_000,
      },
    ).done;
    if (controller.signal.aborted) throw controller.signal.reason;
    evidence.afterRevision = revision(root);
    if (
      evidence.afterRevision.sourceSha256 !== evidence.revision.sourceSha256
    ) {
      code = 1;
      throw new Error(
        'Source changed during runtime verification. Rerun against a stable checkout; both fingerprints are retained.',
      );
    }
  } catch (error) {
    code = code || 1;
    evidence.error = error.message;
    console.error(error.message);
  } finally {
    closingServers = true;
    await Promise.all(
      servers.map(async (server) => {
        await server.stop();
        await server.done;
      }),
    );
    clearTimeout(overallTimeout);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    evidence.status = interrupted
      ? 'interrupted'
      : code === 0
        ? 'passed'
        : 'failed';
    evidence.exitCode = code;
    evidence.finishedAt = new Date().toISOString();
    saveEvidence(directory, evidence);
    console.log(
      `Runtime verification ${evidence.status}. Evidence: ${directory}`,
    );
    process.exitCode = code;
  }
}
