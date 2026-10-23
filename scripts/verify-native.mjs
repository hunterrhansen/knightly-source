import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import {
  evidenceDirectory,
  revision,
  saveEvidence,
} from './runtime-evidence.mjs';
import { startLoggedProcess } from './runtime-process.mjs';
import { availablePort, waitForRuntimeReady } from './verify-runtime.mjs';

export function nativeRuntimeEnvironment(env = process.env) {
  return {
    ...env,
    // Expo binds "localhost"; device URLs use IPv4 loopback/host aliases.
    NODE_OPTIONS:
      `${env.NODE_OPTIONS ?? ''} --dns-result-order=ipv4first`.trim(),
  };
}

export function materializeNativeDragFlow(template, start, end, openBoardPath) {
  if (![start, end].every((point) => /^\d+,\d+$/.test(point ?? '')))
    throw new Error('Drag coordinates must be measured x,y points.');
  if (
    !template.includes(`\${DRAG_START}`) ||
    !template.includes(`\${DRAG_END}`) ||
    !template.includes('- runFlow: open-board.yaml')
  )
    throw new Error(
      'Drag template must contain both endpoints and board setup.',
    );
  // Maestro 2.11 parses absolute swipe coordinates before evaluating variables.
  return template
    .replaceAll(`\${DRAG_START}`, JSON.stringify(start))
    .replaceAll(`\${DRAG_END}`, JSON.stringify(end))
    .replace(
      '- runFlow: open-board.yaml',
      `- runFlow: ${JSON.stringify(openBoardPath)}`,
    );
}

export function parseNativeOptions(args) {
  const options = { port: 0 };
  const fields = {
    '--platform': 'platform',
    '--device': 'device',
    '--port': 'port',
    '--drag-start': 'dragStart',
    '--drag-end': 'dragEnd',
  };
  for (let index = 0; index < args.length; index++) {
    const field = fields[args[index]];
    if (!field || !args[index + 1])
      throw new Error(`Unknown or incomplete native argument: ${args[index]}`);
    options[field] = args[++index];
  }
  if (!['ios', 'android'].includes(options.platform) || !options.device)
    throw new Error(
      'Specify --platform ios|android and --device UUID|emulator-5554.',
    );
  if (
    options.platform === 'ios' &&
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(options.device)
  )
    throw new Error(
      'iOS requires an explicit simulator UUID; booted is ambiguous.',
    );
  if (options.platform === 'android' && !/^emulator-\d+$/.test(options.device))
    throw new Error(
      'Android smoke supports an explicit local emulator serial, such as emulator-5554.',
    );
  if (!/^\d+$/.test(String(options.port)) || Number(options.port) > 65535)
    throw new Error('--port must be 0–65535.');
  options.port = Number(options.port);
  if (Boolean(options.dragStart) !== Boolean(options.dragEnd))
    throw new Error(
      'Supply both --drag-start and --drag-end, measured for e2 and e4 on this device.',
    );
  for (const point of [options.dragStart, options.dragEnd].filter(Boolean)) {
    if (!/^\d+,\d+$/.test(point))
      throw new Error(
        'Drag coordinates must be x,y, measured in the current device screenshot.',
      );
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = evidenceDirectory(root, 'native');
  const controller = new AbortController();
  let interrupted = false;
  let closingMetro = false;
  const interrupt = () => {
    interrupted = true;
    controller.abort(new Error('Native verification interrupted.'));
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error('Native verification timed out after 600000 ms.'),
      ),
    600_000,
  );
  const evidence = {
    startedAt: new Date().toISOString(),
    node: process.version,
    status: 'running',
  };
  let metro;
  let code = 1;
  const inspect = (command, args) => {
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    });
    appendFileSync(
      join(directory, 'preflight.log'),
      `$ ${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}\n`,
    );
    if (result.status !== 0)
      throw new Error(
        `${command} preflight failed: ${result.error?.message || result.stderr}. See docs/runtime-verification.md for local tool/device setup.`,
      );
    return result.stdout.trim();
  };
  try {
    const options = parseNativeOptions(process.argv.slice(2));
    evidence.requestedDevice = options.device;
    evidence.platform = options.platform;
    code = await startLoggedProcess(
      process.execPath,
      ['scripts/check-environment.mjs'],
      {
        root,
        log: join(directory, 'environment.log'),
        signal: controller.signal,
      },
    ).done;
    if (code !== 0)
      throw new Error(
        'Use the pinned Node/npm toolchain before native verification.',
      );
    evidence.revision = revision(root);
    evidence.maestro = inspect('maestro', ['--version']);
    const appId = 'app.knightlychess';
    if (options.platform === 'ios') {
      const devices = JSON.parse(
        inspect('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']),
      ).devices;
      const device = Object.values(devices)
        .flat()
        .find(
          (device) =>
            device.udid === options.device &&
            device.state === 'Booted' &&
            device.isAvailable,
        );
      if (!device)
        throw new Error(
          'The selected iOS simulator is not booted/available. Boot it explicitly before rerunning.',
        );
      evidence.device = device;
      evidence.os = Object.entries(devices).find(([, entries]) =>
        entries.includes(device),
      )[0];
      inspect('xcrun', [
        'simctl',
        'get_app_container',
        options.device,
        appId,
        'app',
      ]);
    } else {
      if (inspect('adb', ['-s', options.device, 'get-state']) !== 'device')
        throw new Error('The selected emulator is not ready.');
      evidence.device = {
        serial: options.device,
        model: inspect('adb', [
          '-s',
          options.device,
          'shell',
          'getprop',
          'ro.product.model',
        ]),
      };
      evidence.os = inspect('adb', [
        '-s',
        options.device,
        'shell',
        'getprop',
        'ro.build.version.release',
      ]);
      if (!inspect('adb', ['-s', options.device, 'shell', 'pm', 'path', appId]))
        throw new Error(
          'Install the Knightly development build on the selected emulator first.',
        );
    }
    const port = await availablePort(options.port);
    const deviceHost = options.platform === 'ios' ? '127.0.0.1' : '10.0.2.2';
    const env = nativeRuntimeEnvironment({
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      STORYBOOK_ENABLED: 'false',
    });
    evidence.metroPort = port;
    evidence.drag = options.dragStart
      ? { start: options.dragStart, end: options.dragEnd }
      : 'not run; supply measured e2/e4 endpoints';
    evidence.manualGates = [
      'VoiceOver/TalkBack spoken output',
      'native hardware keyboard',
      'native drag unless measured endpoints supplied',
    ];
    saveEvidence(directory, evidence);
    metro = startLoggedProcess(
      process.execPath,
      [
        'node_modules/expo/bin/cli',
        'start',
        '--dev-client',
        '--localhost',
        '--port',
        String(port),
      ],
      {
        root,
        env,
        log: join(directory, 'metro.log'),
        signal: controller.signal,
        timeoutMs: 600_000,
      },
    );
    metro.child.once('exit', (status, signal) => {
      if (!closingMetro)
        controller.abort(
          new Error(
            `Owned Metro exited unexpectedly (${status ?? signal}). See metro.log.`,
          ),
        );
    });
    await waitForRuntimeReady(
      `http://127.0.0.1:${port}/status`,
      metro,
      controller.signal,
      90_000,
      () =>
        new RegExp(
          `Waiting on http://(?:localhost|127\\.0\\.0\\.1):${port}(?:\\s|$)`,
        ).test(
          stripVTControlCharacters(
            readFileSync(join(directory, 'metro.log'), 'utf8'),
          ),
        ),
    );
    const launcher = `knightlydev://expo-development-client/?url=${encodeURIComponent(`http://${deviceHost}:${port}`)}`;
    const args = [
      '--device',
      options.device,
      '--platform',
      options.platform,
      'test',
      '--format',
      'JUNIT',
      '--output',
      join(directory, 'report.xml'),
      '--test-output-dir',
      join(directory, 'screenshots'),
      '--debug-output',
      join(directory, 'debug'),
      '-e',
      `DEVCLIENT_URL=${launcher}`,
      '-e',
      `EVIDENCE_DIRECTORY=${directory}`,
      '.maestro/board-smoke.yaml',
    ];
    if (options.dragStart) {
      const dragFlow = join(directory, 'board-drag.yaml');
      writeFileSync(
        dragFlow,
        materializeNativeDragFlow(
          readFileSync(join(root, '.maestro/board-drag.yaml'), 'utf8'),
          options.dragStart,
          options.dragEnd,
          join(root, '.maestro/open-board.yaml'),
        ),
      );
      args.push(dragFlow);
    }
    code = await startLoggedProcess('maestro', args, {
      root,
      env,
      log: join(directory, 'maestro.log'),
      signal: controller.signal,
      timeoutMs: 420_000,
    }).done;
    if (controller.signal.aborted) throw controller.signal.reason;
    evidence.afterRevision = revision(root);
    if (
      evidence.afterRevision.sourceSha256 !== evidence.revision.sourceSha256
    ) {
      code = 1;
      throw new Error(
        'Source changed during native verification. Rerun against a stable checkout.',
      );
    }
  } catch (error) {
    code = code || 1;
    evidence.error = error.message;
    console.error(error.message);
  } finally {
    closingMetro = true;
    if (metro) {
      await metro.stop();
      await metro.done;
    }
    clearTimeout(timer);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    evidence.status = interrupted
      ? 'interrupted'
      : code === 0
        ? 'passed'
        : 'failed';
    evidence.exitCode = code;
    evidence.finishedAt = new Date().toISOString();
    saveEvidence(directory, evidence);
    console.log(`Native smoke ${evidence.status}. Evidence: ${directory}`);
    process.exitCode = code;
  }
}
