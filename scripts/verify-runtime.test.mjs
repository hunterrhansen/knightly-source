import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { test } from 'node:test';
import {
  availablePort,
  parseRuntimeOptions,
  waitForRuntimeReady,
} from './verify-runtime.mjs';

test('runtime port selection rejects malformed and duplicate explicit ports', () => {
  for (const value of ['abc', '-1', '65536', '6010junk']) {
    assert.throws(() => parseRuntimeOptions(['--port', value]), /port/i);
  }
  assert.throws(
    () => parseRuntimeOptions(['--port', '6010', '--production-port', '6010']),
    /different/i,
  );
  assert.throws(() => parseRuntimeOptions(['--board-onliy']), /Unknown/);
  assert.equal(parseRuntimeOptions(['--board-only']).boardOnly, true);
  assert.equal(parseRuntimeOptions([]).boardOnly, false);
});

test('occupied explicit ports fail without adopting or killing the existing listener', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  await assert.rejects(availablePort(server.address().port), /EADDRINUSE/);
  assert.equal(server.listening, true);
  const port = await availablePort();
  assert.ok(port > 0 && port !== server.address().port);
});

test('successful HTTP from a competing preview is not readiness without the owned handshake', async (t) => {
  const server = createHttpServer((_, response) =>
    response.end('stale preview'),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/index.json`;
  const run = { child: { exitCode: null, signalCode: null } };
  await assert.rejects(
    waitForRuntimeReady(url, run, undefined, 150, () => false),
    /readiness timed out/,
  );
  assert.equal(server.listening, true);
});
