import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startLoggedProcess } from './runtime-process.mjs';

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knightly-runtime-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, log: join(root, 'run.log') };
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('runtime child failure preserves exit status and both output streams', async (t) => {
  const options = fixture(t);
  const run = startLoggedProcess(
    process.execPath,
    ['-e', 'console.log("ready"); console.error("broken"); process.exit(7)'],
    options,
  );
  assert.equal(await run.done, 7);
  assert.match(readFileSync(options.log, 'utf8'), /ready/);
  assert.match(readFileSync(options.log, 'utf8'), /broken/);
});

test('bounded timeout removes owned descendants without stopping another server', async (t) => {
  if (process.platform === 'win32')
    return t.skip('POSIX descendant PID assertion; Windows uses taskkill');
  const options = fixture(t);
  const unrelated = createServer((_, response) =>
    response.end('still running'),
  );
  await new Promise((resolve) => unrelated.listen(0, '127.0.0.1', resolve));
  t.after(() => unrelated.close());
  const child = 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)';
  const program = `const {spawn}=require('node:child_process'); const fs=require('node:fs'); const descendant=spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'ignore'}); fs.writeFileSync('pids.json',JSON.stringify([process.pid,descendant.pid])); console.log('started'); setInterval(()=>{},1000);`;
  const run = startLoggedProcess(process.execPath, ['-e', program], {
    ...options,
    timeoutMs: 1000,
  });
  assert.notEqual(await run.done, 0);
  const pids = JSON.parse(
    readFileSync(join(options.root, 'pids.json'), 'utf8'),
  );
  for (let attempt = 0; attempt < 30 && pids.some(alive); attempt++)
    await delay(50);
  assert.equal(pids.some(alive), false);
  assert.match(readFileSync(options.log, 'utf8'), /timed out/);
  const url = `http://127.0.0.1:${unrelated.address().port}`;
  assert.equal(await (await fetch(url)).text(), 'still running');
});

test('aborting a run stops its process and retains interruption diagnostics', async (t) => {
  const options = fixture(t);
  const controller = new AbortController();
  const run = startLoggedProcess(
    process.execPath,
    ['-e', 'setInterval(()=>{},1000)'],
    { ...options, signal: controller.signal },
  );
  controller.abort();
  assert.notEqual(await run.done, 0);
  assert.match(readFileSync(options.log, 'utf8'), /interrupted/);
});
