import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bateria E2E (Playwright) tem runner próprio: `npm run test:e2e`.
    // Servidor de licenças idem: `node --test server/server.test.mjs`.
    exclude: ['e2e/**', 'node_modules/**', 'dist-web/**', 'src-tauri/**', 'server/**'],
  },
});
