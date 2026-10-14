import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume shared TypeScript sources directly (ESM) instead of the CommonJS build.
      '@flagforge/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // ADR-0007: in development Vite proxies the API; in production NestJS serves the SPA.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
