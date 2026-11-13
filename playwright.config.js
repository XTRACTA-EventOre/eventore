import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 0.0.0.0 --port 4173 --strictPort',
    url: 'http://localhost:4173', reuseExistingServer: false }
});
