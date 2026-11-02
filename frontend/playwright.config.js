import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: { command: 'npm start --prefix ../backend', url: 'http://localhost:3000/api/v1/health', reuseExistingServer: false }
});
