import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkArchitecture } from './check-architecture.mjs';

function fixture(t, files, featurePublicFiles = []) {
  const root = mkdtempSync(join(tmpdir(), 'knightly-architecture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src'));
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'preserve',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        paths: { '@/*': ['./src/*'] },
      },
    }),
  );
  writeFileSync(
    join(root, 'architecture.config.json'),
    JSON.stringify({ featurePublicFiles }),
  );
  for (const [name, content] of Object.entries(files)) {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test('shared production code cannot reach features through aliases, re-exports or literal require', (t) => {
  const root = fixture(t, {
    'src/chess/board/a.ts':
      'export { value } from "@/features/practice/private";',
    'src/components/ui/a.ts':
      'const value = require("../../features/practice/private");',
    'src/ui/a.ts': 'export { value } from "@/features/practice/private";',
    'src/theme/a.ts':
      'import type { value } from "@/features/practice/private";',
    'src/features/practice/private.ts': 'export const value = 1;',
  });
  const issues = checkArchitecture(root);
  for (const file of [
    'src/chess/board/a.ts',
    'src/components/ui/a.ts',
    'src/theme/a.ts',
    'src/ui/a.ts',
  ]) {
    assert.ok(
      issues.some(
        (issue) => issue.includes(file) && issue.includes('shared code'),
      ),
    );
  }
});

test('import casing cannot bypass shared boundaries or cycles', (t) => {
  const root = fixture(t, {
    'src/theme/a.ts': 'import "@/Features/practice/private";',
    'src/features/practice/private.ts': 'export {};',
    'src/chess/a.ts': 'import "./B";',
    'src/chess/b.ts': 'import "./a";',
  });
  const issues = checkArchitecture(root);
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('shared code') ||
        issue.includes('unresolved local import @/Features'),
    ),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('cycle') ||
        issue.includes('unresolved local import ./B'),
    ),
  );
});

test('infrastructure cannot import routes, and chess cannot import infrastructure', (t) => {
  const issues = checkArchitecture(
    fixture(t, {
      'src/lib/api.ts': 'import "../app/index";',
      'src/app/index.ts': 'export {};',
      'src/chess/board/a.ts': 'import "../../lib/api";',
    }),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('shared code') && issue.includes('src/lib/api.ts'),
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.includes('chess') && issue.includes('infrastructure'),
    ),
  );
});

test('cross-feature private type imports and dynamic imports fail while registered public files pass', (t) => {
  const root = fixture(
    t,
    {
      'src/features/review/a.ts':
        'import type { Value } from "@/features/practice/private"; import("../practice/private");',
      'src/features/review/b.ts': 'import { value } from "../practice/public";',
      'src/features/practice/private.ts':
        'export type Value = number; export const value = 1;',
      'src/features/practice/public.ts': 'export { value } from "./private";',
    },
    ['src/features/practice/public.ts'],
  );
  const issues = checkArchitecture(root);
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('src/features/review/a.ts') &&
        issue.includes('private cross-feature'),
    ),
  );
  assert.equal(
    issues.some((issue) => issue.includes('src/features/review/b.ts')),
    false,
  );
});

test('legal composition, same-feature imports, stories and pure type contracts remain valid', (t) => {
  assert.deepEqual(
    checkArchitecture(
      fixture(t, {
        'src/app/index.ts': 'import "../features/practice/private";',
        'src/features/practice/private.ts':
          'import "./helper"; import "../../chess/board/view";',
        'src/features/practice/helper.ts': 'export {};',
        'src/chess/board/view.ts': 'import "../../components/ui/button";',
        'src/components/ui/button.ts': 'import "../../theme/tokens";',
        'src/theme/tokens.ts': 'export {};',
        'src/chess/board/view.stories.ts':
          'import "../../features/practice/private";',
        'src/chess/move.ts': 'import { type Move } from "./board/board.types";',
        'src/chess/board/board.types.ts': 'export type Move = number;',
      }),
    ),
    [],
  );
});

test('features and routes reach shared UI only through src/ui', (t) => {
  const issues = checkArchitecture(
    fixture(t, {
      'src/features/practice/screen.ts':
        'import "../../components/ui/button"; import "../../ui";',
      'src/app/index.ts': 'import "../components/ui/button";',
      'src/ui/index.ts': 'export * from "../components/ui/button";',
      'src/components/ui/button.ts': 'import "./card";',
      'src/components/ui/card.ts': 'export {};',
    }),
  );
  for (const file of ['src/features/practice/screen.ts', 'src/app/index.ts']) {
    assert.ok(
      issues.some((issue) => issue.includes(file) && issue.includes('src/ui')),
      file,
    );
  }
  assert.equal(
    issues.length,
    2,
    'src/ui and components/ui may import components/ui',
  );
});

test('pure chess cannot import rendering or React, and production cannot import story/test escape hatches', (t) => {
  const issues = checkArchitecture(
    fixture(t, {
      'src/chess/move.ts':
        'import "react"; import "./board/view"; import "../ui/index";',
      'src/ui/index.ts': 'export {};',
      'src/chess/board/view.ts': 'import "./view.stories";',
      'src/chess/board/view.stories.ts': 'export {};',
    }),
  );
  assert.ok(
    issues.some(
      (issue) => issue.includes('pure chess') && issue.includes('react'),
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.includes('pure chess') && issue.includes('board/view'),
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.includes('pure chess') && issue.includes('ui/index'),
    ),
  );
  assert.ok(issues.some((issue) => issue.includes('development-only')));
});

test('indirect cycles through a barrel and import types fail with the chain', (t) => {
  const issues = checkArchitecture(
    fixture(t, {
      'src/features/practice/a.ts':
        'import type { Value } from "./index"; export type Other = number;',
      'src/features/practice/index.ts': 'export type { Value } from "./b";',
      'src/features/practice/b.ts':
        'type Other = import("./a").Other; export type Value = Other;',
    }),
  );
  assert.ok(
    issues.some((issue) =>
      /circular dependency.*a\.ts.*index\.ts.*b\.ts.*a\.ts/.test(issue),
    ),
  );
});

test('platform variants resolve separately, detect iOS-only cycles and do not combine incompatible branches', (t) => {
  const root = fixture(t, {
    'src/features/practice/a.ts': 'import "./adapter";',
    'src/features/practice/adapter.web.ts': 'import "./web-helper";',
    'src/features/practice/web-helper.web.ts': 'export {};',
    'src/features/practice/adapter.native.ts': 'export {};',
    'src/features/practice/adapter.ios.ts': 'import "./a";',
  });
  const issues = checkArchitecture(root);
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('[ios]') && issue.includes('circular dependency'),
    ),
  );
  assert.equal(
    issues.some(
      (issue) => issue.includes('[web]') || issue.includes('[android]'),
    ),
    false,
  );
});

test('a registered public base file permits its platform variants', (t) => {
  assert.deepEqual(
    checkArchitecture(
      fixture(
        t,
        {
          'src/features/review/a.ts': 'import "../practice/public";',
          'src/features/practice/public.ts': 'export {};',
          'src/features/practice/public.web.ts': 'export {};',
          'src/features/practice/public.native.ts': 'export {};',
        },
        ['src/features/practice/public.ts'],
      ),
    ),
    [],
  );
});

test('unresolved local imports, computed imports and parse failures cannot silently escape checks', (t) => {
  const issues = checkArchitecture(
    fixture(t, {
      'src/features/practice/a.ts':
        'import "@/features/practice/missing"; import(name);',
      'src/features/practice/b.ts': 'export const =;',
    }),
  );
  assert.ok(issues.some((issue) => issue.includes('unresolved local import')));
  assert.ok(issues.some((issue) => issue.includes('computed import')));
  assert.ok(issues.some((issue) => issue.includes('syntax')));
});

test('comments and string contents are not imports; existing asset requires remain valid', (t) => {
  assert.deepEqual(
    checkArchitecture(
      fixture(t, {
        'src/theme/fonts.ts':
          '// import "../features/private";\nconst example = "require(unknown)"; const font = require("../../assets/font.ttf");',
        'assets/font.ttf': 'fixture',
      }),
    ),
    [],
  );
});

test('an existing directory without an entry point is not mistaken for an asset', (t) => {
  const root = fixture(t, {
    'src/features/practice/a.ts': 'import "./empty";',
  });
  mkdirSync(join(root, 'src/features/practice/empty'));
  assert.ok(
    checkArchitecture(root).some((issue) =>
      issue.includes('unresolved local import ./empty'),
    ),
  );
});

test('public-file configuration rejects nonexistent and development-only entries', (t) => {
  const issues = checkArchitecture(
    fixture(
      t,
      {
        'src/features/practice/a.test.ts': 'export {};',
      },
      ['src/features/practice/missing.ts', 'src/features/practice/a.test.ts'],
    ),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.includes('architecture.config.json') &&
        issue.includes('missing.ts'),
    ),
  );
  assert.ok(issues.some((issue) => issue.includes('development-only')));
});

test('CLI returns a nonzero exit and actionable file/line for an actual boundary violation', (t) => {
  const root = fixture(t, {
    'src/theme/tokens.ts': 'import "../features/practice/private";',
    'src/features/practice/private.ts': 'export {};',
  });
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./check-architecture.mjs', import.meta.url))],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/theme\/tokens\.ts:1.*shared code.*Move/);
});

test('Expo cannot import backend implementation', (t) => {
  const root = fixture(t, {
    'src/lib/api.ts': 'import "../../backend/server.mjs";',
    'backend/server.mjs': 'export const value = 2;',
  });
  const issues = checkArchitecture(root);
  for (const file of ['src/lib/api.ts']) {
    assert.ok(
      issues.some(
        (issue) => issue.includes(file) && issue.includes('package boundary'),
      ),
    );
  }
});
