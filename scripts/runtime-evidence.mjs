import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/**
 * The environment for running git in `root` itself: without the GIT_DIR and
 * related variables git exports to hooks, which would point at another repo.
 */
export function gitEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
}

export function revision(root) {
  const git = (args) => {
    const result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      env: gitEnvironment(),
    });
    if (result.status !== 0)
      throw new Error(
        `Cannot record revision: ${result.stderr || result.error?.message}`,
      );
    return result.stdout;
  };
  const files = git([
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ])
    .split('\0')
    .filter(Boolean)
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\0`);
    try {
      const path = join(root, file);
      hash.update(
        lstatSync(path).isSymbolicLink()
          ? readlinkSync(path)
          : readFileSync(path),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('<deleted>');
    }
    hash.update('\0');
  }
  return {
    commit: git(['rev-parse', 'HEAD']).trim(),
    dirty: git(['status', '--short']).trim(),
    sourceSha256: hash.digest('hex'),
  };
}

export function evidenceDirectory(root, kind) {
  const directory = join(
    root,
    '.verification',
    `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`,
  );
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function saveEvidence(directory, evidence) {
  writeFileSync(
    join(directory, 'run.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
