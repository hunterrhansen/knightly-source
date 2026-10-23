import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gitEnvironment, revision } from './runtime-evidence.mjs';

test('evidence identifies dirty tracked/untracked source changes while ignoring runtime artifacts', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      stdio: 'ignore',
      env: gitEnvironment(),
    });
  git('init');
  writeFileSync(join(root, '.gitignore'), '.verification/\n');
  writeFileSync(join(root, 'board.ts'), 'export const board = 1;');
  git('add', '.');
  git(
    '-c',
    'user.name=Runtime fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'fixture',
  );
  const before = revision(root);
  assert.equal(before.dirty, '');
  mkdirSync(join(root, '.verification'));
  writeFileSync(join(root, '.verification/report.json'), '{}');
  assert.equal(revision(root).sourceSha256, before.sourceSha256);
  writeFileSync(join(root, 'board.ts'), 'export const board = 2;');
  const changed = revision(root);
  assert.equal(changed.commit, before.commit);
  assert.notEqual(changed.sourceSha256, before.sourceSha256);
  assert.match(changed.dirty, /board.ts/);
  writeFileSync(join(root, 'new-board.ts'), 'export {};');
  const untracked = revision(root);
  assert.notEqual(untracked.sourceSha256, changed.sourceSha256);
  assert.match(untracked.dirty, /\?\? new-board.ts/);
});
