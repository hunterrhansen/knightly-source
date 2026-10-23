import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkEnvironment } from './check-environment.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'knightly-env-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, '.nvmrc'), '24.21.0\n');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      engines: { node: '24.21.0', npm: '11.21.0' },
      packageManager: 'npm@11.21.0',
    }),
  );
  return root;
}

test('matching runtime and consistent pins pass', (t) => {
  assert.deepEqual(checkEnvironment(fixture(t), '24.21.0', '11.21.0'), []);
});

test('wrong Node and npm report both versions and concrete fixes', (t) => {
  const issues = checkEnvironment(fixture(t), '22.22.2', '10.9.7');
  assert.equal(issues.length, 2);
  assert.match(issues[0], /22\.22\.2.*24\.21\.0.*nvm install/s);
  assert.match(
    issues[1],
    /10\.9\.7.*11\.21\.0.*npm install --global npm@11\.21\.0/s,
  );
});

test('disagreeing toolchain pins fail even with matching runtime', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.nvmrc'), '22.22.2\n');
  const issues = checkEnvironment(root, '24.21.0', '11.21.0');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /\.nvmrc.*engines.node/);
});

test('missing or ranged pins fail rather than accepting an unpinned runtime', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'package.json'), '{"engines":{"node":">=24"}}');
  assert.ok(checkEnvironment(root, '24.21.0', '11.21.0').length > 0);
});

test('packageManager drift fails even when runtime matches engines', (t) => {
  const root = fixture(t);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  manifest.packageManager = 'npm@10.9.7';
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  const issues = checkEnvironment(root, '24.21.0', '11.21.0');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /packageManager.*engines.npm/);
});
