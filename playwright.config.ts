import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 120000, workers: 1,
  expect: { timeout: 45000 },
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 960, height: 600 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --outDir dist-e2e', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});
