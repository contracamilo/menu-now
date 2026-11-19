/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { EARLY_FETCHES } from './src/lib/publicQueries';

/**
 * design D6: en `/`, un script inline pide la carta y los datos del local mientras se descarga
 * el JS, en lugar de esperar a que se ejecute. La app recoge esas peticiones la primera vez.
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
      const requests = EARLY_FETCHES.map(({ global, table, params }) => {
        const url = `${base}/rest/v1/${table}?${new URLSearchParams(params)}`;
        return `window.${global}=get(${JSON.stringify(url)});`;
      }).join('');
      const code =
        `if(location.pathname==='/'){var get=function(u){var p=fetch(u,{headers:{apikey:${JSON.stringify(key)},Accept:'application/json'}})` +
        `.then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()});p.catch(function(){});return p};${requests}}`;
      return [{ tag: 'script', children: code, injectTo: 'head' }];
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
