import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const check = process.argv.includes('--check');
const temp = check ? mkdtempSync(join(tmpdir(), 'knightly-contract-')) : null;
const output = check ? join(temp, 'schema.d.ts') : 'src/lib/api/schema.d.ts';
try {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/openapi-typescript/bin/cli.js',
      'contracts/knightly.openapi.json',
      '-o',
      output,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else if (
    check &&
    readFileSync(output, 'utf8') !==
      readFileSync('src/lib/api/schema.d.ts', 'utf8')
  ) {
    console.error('API types drifted. Run npm run api:generate.');
    process.exitCode = 1;
  }
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
