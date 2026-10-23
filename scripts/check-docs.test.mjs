import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkDocs } from './check-docs.mjs';

test('local files, directories, encoded paths and references resolve relative to each document', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  writeFileSync(
    join(root, 'docs/index.md'),
    '[readme](../README.md)\n[guide]: a%20file.md#file\n',
  );
  writeFileSync(join(root, 'docs/a file.md'), '# File');
  writeFileSync(
    join(root, 'README.md'),
    '[docs](docs/)\n[file](docs/a%20file.md#file)\n[ref][guide]\n[guide]: docs/a%20file.md\n',
  );
  assert.deepEqual(checkDocs(root), []);
});

test('broken inline and reference destinations report file and line; code examples and remote links are ignored', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/index.md'), '[readme](../README.md)');
  writeFileSync(
    join(root, 'README.md'),
    '[bad](missing.md)\n[guide]: missing-too.md\n```md\n[example](imaginary.md)\n```\n`[example](imaginary.md)`\n[web](https://example.com)\n[anchor](#here)\n',
  );
  const issues = checkDocs(root);
  assert.equal(issues.length, 2);
  assert.match(issues[0], /README.md:1.*missing.md/);
  assert.match(issues[1], /README.md:2.*missing-too.md/);
});

test('unindexed root, nested and license docs fail; directory links and code examples do not index files', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/specs'), { recursive: true });
  mkdirSync(join(root, 'assets/licenses'), { recursive: true });
  writeFileSync(join(root, 'README.md'), '# Setup');
  writeFileSync(join(root, 'docs/specs/board.md'), '# Contract');
  writeFileSync(join(root, 'assets/licenses/README.md'), '# Licenses');
  writeFileSync(
    join(root, 'docs/index.md'),
    '[specs](specs/)\n```md\n[setup](../README.md)\n```\n`[board](specs/board.md)`\n',
  );
  assert.deepEqual(
    checkDocs(root).sort(),
    [
      'README.md: not linked from docs/index.md',
      'assets/licenses/README.md: not linked from docs/index.md',
      'docs/specs/board.md: not linked from docs/index.md',
    ].sort(),
  );
  writeFileSync(
    join(root, 'docs/index.md'),
    '[setup](../README.md)\n[board](specs/board.md)\n[licenses](../assets/licenses/README.md)\n',
  );
  assert.deepEqual(checkDocs(root), []);
});

test('a missing documentation index fails even when there are no other docs', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(checkDocs(root), [
    'docs/index.md: missing documentation index',
  ]);
});

test('backticked repository paths must exist; module paths, placeholders, ignored and non-repository paths pass', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'src/ui'), { recursive: true });
  mkdirSync(join(root, '.verification'));
  mkdirSync(join(root, 'public'));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(
    join(root, '.gitignore'),
    '.verification/\npublic/canvaskit.wasm\n',
  );
  writeFileSync(join(root, 'src/ui/rive.ts'), '');
  writeFileSync(join(root, 'docs/index.md'), '[readme](../README.md)');
  writeFileSync(
    join(root, 'README.md'),
    [
      '`src/ui/rive` and `src/ui/rive.ts:3` and `docs/index.md#top` exist.',
      '`src/<feature>/x.ts`, `src/**/*.ts` and `src/…` are placeholders.',
      'Ignored `.verification/run.log` and `public/canvaskit.wasm`; `legacy/docs/design.md` and `/opt/knightly` are not checked.',
      '```sh',
      'cat src/gone.ts `src/gone.ts`',
      '```',
      'Renamed: `src/ui/removed.tsx` and ``src/old/``.',
    ].join('\n'),
  );
  assert.deepEqual(checkDocs(root), [
    'README.md:7: missing repository path src/ui/removed.tsx',
    'README.md:7: missing repository path src/old/',
  ]);
});
