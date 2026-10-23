import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runChecks(steps, root, logDirectory) {
  mkdirSync(logDirectory, { recursive: true });
  for (const step of steps) {
    const log = join(logDirectory, `${step.name.replace(/[^\w.-]/g, '-')}.log`);
    writeFileSync(log, '');
    console.log(`\nChecking ${step.name}…`);
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, step.args, {
        cwd: root,
        env: { ...process.env, CI: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      for (const [stream, output] of [
        [child.stdout, process.stdout],
        [child.stderr, process.stderr],
      ]) {
        stream.on('data', (chunk) => {
          appendFileSync(log, chunk);
          output.write(chunk);
        });
      }
      child.on('error', (error) => {
        appendFileSync(log, `${error.message}\n`);
        console.error(error.message);
        resolve(1);
      });
      child.on('close', (status, signal) => {
        const result = status ?? 1;
        appendFileSync(
          log,
          `\nExit: ${result}${signal ? ` (${signal})` : ''}\n`,
        );
        resolve(result);
      });
    });
    if (code !== 0) {
      console.error(`${step.name} failed (exit ${code}). Log: ${log}`);
      return code;
    }
  }
  console.log(`\nVerification passed. Logs: ${logDirectory}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const full = process.argv.includes('--full');
  if (process.argv.slice(2).some((argument) => argument !== '--full')) {
    console.error('Usage: npm run verify or npm run verify:full');
    process.exitCode = 1;
  } else if (!process.env.npm_execpath) {
    console.error('Run through npm: npm run verify or npm run verify:full.');
    process.exitCode = 1;
  } else {
    const npm = (name) => ({
      name,
      args: [process.env.npm_execpath, 'run', name],
    });
    const steps = [
      'env:check',
      'docs:check',
      'test:tooling',
      'architecture:check',
      'unused:check',
      'api:check',
      'lint',
      'typecheck',
      'test:ci',
    ];
    if (full)
      steps.push('expo:check', 'expo:doctor', 'storybook:build', 'export');
    const root = fileURLToPath(new URL('../', import.meta.url));
    process.exitCode = await runChecks(
      steps.map(npm),
      root,
      join(
        root,
        '.verification',
        `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`,
      ),
    );
  }
}
