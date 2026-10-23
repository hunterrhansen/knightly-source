import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Each command owns a process group. Cleanup never searches for/kills a port owner.
export function startLoggedProcess(
  command,
  args,
  { root, log, env = process.env, timeoutMs = 600_000, signal, graceMs = 1000 },
) {
  mkdirSync(dirname(log), { recursive: true });
  writeFileSync(log, '');
  const child = spawn(command, args, {
    cwd: root,
    env,
    detached: process.platform !== 'win32',
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
  let stopped;
  let interrupted = false;
  const stop = () => {
    stopped ??= (async () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          timeout: 5000,
        });
        return;
      }
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        if (error.code === 'ESRCH') return;
        throw error;
      }
      // Descendants may outlive a gracefully exiting parent.
      await delay(graceMs);
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    })();
    return stopped;
  };
  const interrupt = (reason) => {
    interrupted = true;
    appendFileSync(log, `\n${reason}\n`);
    void stop();
  };
  const aborted = () => interrupt('Runtime command interrupted.');
  const timer = setTimeout(
    () => interrupt(`Runtime command timed out after ${timeoutMs} ms.`),
    timeoutMs,
  );
  signal?.addEventListener('abort', aborted, { once: true });
  if (signal?.aborted) aborted();
  const done = new Promise((resolve) => {
    child.on('error', (error) => appendFileSync(log, `${error.message}\n`));
    child.on('close', async (status, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      await stop();
      const code = interrupted
        ? 1
        : status !== null && status >= 0
          ? status
          : 1;
      appendFileSync(
        log,
        `\nExit: ${code}${exitSignal ? ` (${exitSignal})` : ''}\n`,
      );
      resolve(code);
    });
  });
  return { child, done, stop };
}
