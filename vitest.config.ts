import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bateria E2E (Playwright) tem runner próprio: `npm run test:e2e`.
    exclude: ['e2e/**', 'node_modules/**', 'dist-web/**', 'src-tauri/**'],
  },
});
