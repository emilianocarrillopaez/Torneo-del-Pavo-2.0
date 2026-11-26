import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const containerShellPath =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';
const useContainerChromium = fs.existsSync(containerShellPath);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: './reports/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports/playwright/html', open: 'never' }],
    ['json', { outputFile: './reports/playwright/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    headless: true,
    launchOptions: useContainerChromium
      ? { executablePath: containerShellPath }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
