import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkEnvironment(root, nodeVersion, npmVersion) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const nodePin = manifest.engines?.node;
  const npmPin = manifest.engines?.npm;
  const nvmPin = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
  const issues = [];
  for (const [name, pin] of [
    ['node', nodePin],
    ['npm', npmPin],
  ]) {
    if (!/^\d+\.\d+\.\d+$/.test(pin ?? '')) {
      issues.push(
        `package.json engines.${name} must specify an exact version.`,
      );
    }
  }
  if (nvmPin !== nodePin) {
    issues.push(
      '.nvmrc and package.json engines.node disagree; align the committed pins.',
    );
  }
  if (manifest.packageManager !== `npm@${npmPin}`) {
    issues.push('package.json packageManager must match engines.npm.');
  }
  if (nodeVersion !== nodePin) {
    issues.push(
      `Node ${nodeVersion} does not match ${nodePin}. Run nvm install && nvm use (or select .nvmrc in your version manager).`,
    );
  }
  if (npmVersion !== npmPin) {
    issues.push(
      `npm ${npmVersion || 'unavailable'} does not match ${npmPin}. After selecting Node, run npm install --global npm@${npmPin}.`,
    );
  }
  return issues;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const npm = process.env.npm_execpath;
    const result = npm
      ? spawnSync(process.execPath, [npm, '--version'], { encoding: 'utf8' })
      : spawnSync(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['--version'],
          {
            encoding: 'utf8',
            shell: process.platform === 'win32',
          },
        );
    const issues = checkEnvironment(
      fileURLToPath(new URL('../', import.meta.url)),
      process.versions.node,
      result.status === 0 ? result.stdout.trim() : '',
    );
    if (issues.length) {
      console.error(
        `Environment preflight failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Environment OK: Node ${process.versions.node}, npm ${result.stdout.trim()}.`,
      );
    }
  } catch (error) {
    console.error(`Environment preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
