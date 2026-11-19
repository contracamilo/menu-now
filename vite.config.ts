/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { earlyFetchScript } from './src/lib/publicQueries';

/**
 * design D6: en `/` y en `/t/<token>`, un script inline pide la carta, los datos del local y la mesa
 * mientras se descarga el JS, en lugar de esperar a que se ejecute. La app recoge esas peticiones la primera vez.
 */
function earlyPublicFetches(): Plugin {
  let base = '';
  let key = '';
  return {
    name: 'menu-now:early-public-fetches',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'VITE_');
      base = env.VITE_SUPABASE_URL ?? '';
      key = env.VITE_SUPABASE_ANON_KEY ?? '';
    },
    transformIndexHtml() {
      if (!base.startsWith('http') || !key) return [];
      return [{ tag: 'script', children: earlyFetchScript(base, key), injectTo: 'head' }];
    },
  };
}

export default defineConfig({
  plugins: [react(), earlyPublicFetches()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
