import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:1430',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 1430 --strictPort',
    url: 'http://127.0.0.1:1430',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
