import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runChecks } from './verify.mjs';

test('failed child preserves exit code and diagnostics, and stops later checks', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-verify-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const code = await runChecks(
    [
      {
        name: 'test:failure',
        args: ['-e', 'console.error("test failure"); process.exit(7)'],
      },
      {
        name: 'later',
        args: ['-e', 'require("node:fs").writeFileSync("unexpected", "ran")'],
      },
    ],
    root,
    join(root, 'logs'),
  );
  assert.equal(code, 7);
  assert.match(
    readFileSync(join(root, 'logs/test-failure.log'), 'utf8'),
    /test failure/,
  );
  assert.equal(existsSync(join(root, 'unexpected')), false);
});

test('successful checks run sequentially and retain output', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-verify-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const code = await runChecks(
    [
      {
        name: 'first',
        args: ['-e', 'require("node:fs").writeFileSync("ready", "yes")'],
      },
      {
        name: 'second',
        args: [
          '-e',
          'console.log(require("node:fs").readFileSync("ready", "utf8"))',
        ],
      },
    ],
    root,
    join(root, 'logs'),
  );
  assert.equal(code, 0);
  assert.match(readFileSync(join(root, 'logs/second.log'), 'utf8'), /yes/);
});
