import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  materializeNativeDragFlow,
  nativeRuntimeEnvironment,
  parseNativeOptions,
} from './verify-native.mjs';

test('drag flow materializes measured absolute coordinates before Maestro parsing', () => {
  const template = readFileSync(
    new URL('../.maestro/board-drag.yaml', import.meta.url),
    'utf8',
  );
  const flow = materializeNativeDragFlow(
    template,
    '120,360',
    '120,280',
    '/a workspace/.maestro/open-board.yaml',
  );
  assert.match(flow, /start: "120,360"/);
  assert.match(flow, /end: "120,280"/);
  assert.match(flow, /runFlow: "\/a workspace\/\.maestro\/open-board.yaml"/);
  assert.doesNotMatch(flow, /\$\{DRAG_(?:START|END)\}/);
  assert.throws(
    () => materializeNativeDragFlow(template, 'bad', '120,280', 'setup'),
    /measured/,
  );
  assert.throws(
    () => materializeNativeDragFlow('', '120,360', '120,280', 'setup'),
    /template/,
  );
});

test('owned Metro resolves localhost to IPv4 for simulator/emulator URLs', () => {
  const env = nativeRuntimeEnvironment({
    ...process.env,
    NODE_OPTIONS: '--no-warnings',
  });
  assert.match(env.NODE_OPTIONS, /--no-warnings/);
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      'const s=require("node:net").createServer();s.listen(0,"localhost",()=>{console.log(s.address().family);s.close()})',
    ],
    { env, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'IPv4');
});

test('native smoke requires an explicit simulator/emulator, never choosing another device', () => {
  assert.throws(() => parseNativeOptions([]), /platform.*device/i);
  assert.throws(
    () => parseNativeOptions(['--platform', 'ios', '--device', 'booted']),
    /UUID/,
  );
  assert.throws(
    () =>
      parseNativeOptions(['--platform', 'android', '--device', 'phone-serial']),
    /emulator/,
  );
  const options = parseNativeOptions([
    '--platform',
    'android',
    '--device',
    'emulator-5554',
    '--port',
    '8090',
  ]);
  assert.equal(options.device, 'emulator-5554');
  assert.equal(options.port, 8090);
});

test('native drag needs both measured endpoints and rejects malformed coordinates', () => {
  const args = ['--platform', 'android', '--device', 'emulator-5554'];
  assert.throws(
    () => parseNativeOptions([...args, '--drag-start', '10,20']),
    /both/i,
  );
  assert.throws(
    () =>
      parseNativeOptions([
        ...args,
        '--drag-start',
        'bad',
        '--drag-end',
        '10,20',
      ]),
    /coordinates/i,
  );
  const options = parseNativeOptions([
    ...args,
    '--drag-start',
    '120,360',
    '--drag-end',
    '120,280',
  ]);
  assert.equal(options.dragStart, '120,360');
  assert.equal(options.dragEnd, '120,280');
});
