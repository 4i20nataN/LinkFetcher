import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bateria E2E (Playwright) tem runner próprio: `npm run test:e2e`.
    // Servidor de licenças legado idem: `node --test server/server.test.mjs`.
    // O Worker em produção (server/worker/**) roda aqui: é o código no ar.
    exclude: ['e2e/**', 'node_modules/**', 'dist-web/**', 'src-tauri/**', 'server/server.test.mjs'],
  },
});
