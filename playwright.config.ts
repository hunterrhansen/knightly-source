import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const directory = process.env.RUNTIME_DIRECTORY;
if (!directory)
  throw new Error('Use npm run test:runtime or npm run test:board.');
const storybookURL = `http://127.0.0.1:${process.env.RUNTIME_PORT}`;
const productionURL = `http://127.0.0.1:${process.env.RUNTIME_PRODUCTION_PORT}`;
const appPort = process.env.RUNTIME_APP_PORT;
const appURL = `http://127.0.0.1:${appPort}`;
const full = process.env.RUNTIME_PRODUCTION === '1';
if (full && !appPort)
  throw new Error('The runtime runner must select an app port.');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  globalTimeout: 540_000,
  outputDir: join(directory, 'results'),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: join(directory, 'report') }],
    ['json', { outputFile: join(directory, 'results.json') }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'board',
      testMatch: '**/board-smoke.spec.ts',
      use: { baseURL: storybookURL },
    },
    ...(full
      ? [
          {
            name: 'app',
            testMatch: '**/app-smoke.spec.ts',
            use: { baseURL: appURL },
          },
          {
            name: 'production',
            testMatch: '**/production-smoke.spec.ts',
            use: { baseURL: productionURL },
          },
        ]
      : []),
  ],
  webServer: full
    ? {
        command: `node node_modules/expo/bin/cli start --web --localhost --port ${appPort}`,
        url: appURL,
        env: {
          EXPO_PUBLIC_API_URL: 'http://127.0.0.1:0',
          NODE_OPTIONS:
            `${process.env.NODE_OPTIONS ?? ''} --dns-result-order=ipv4first`.trim(),
        },
        reuseExistingServer: false,
        stdout: 'pipe',
        timeout: 120_000,
      }
    : undefined,
});
