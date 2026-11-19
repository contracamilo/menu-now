// Rendimiento y accesibilidad de la carta (design D7 y D10) con Lighthouse CI:
// build de producción + vite preview contra el Supabase local con la carta de referencia.
// Cubre [menu] «La carta carga a tiempo en condiciones de referencia» y (auditoría axe AA)
// «El comensal usa la carta con lector de pantalla».
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);

// 1. La medición solo vale con la carta de referencia de supabase/seed.sql
const response = await fetch(
  `${env.VITE_SUPABASE_URL}/rest/v1/dishes?select=id&archived_at=is.null`,
  { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Prefer: 'count=exact', Range: '0-0' } },
).catch(() => null);
const total = Number(response?.headers.get('content-range')?.split('/')[1]);
if (total !== 60) {
  console.error(
    `La carta de referencia no está cargada (platos activos: ${Number.isNaN(total) ? 'Supabase no responde' : total}).\n` +
      'Arranca Supabase (npm run db:start) y carga el seed (npm run db:reset).',
  );
  process.exit(1);
}

// 2. Build de producción
execFileSync('npx', ['vite', 'build'], { stdio: 'inherit' });

// 3. Lighthouse CI con el Chromium de Playwright
const result = spawnSync('npx', ['lhci', 'autorun'], {
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chromium.executablePath() },
});
process.exit(result.status ?? 1);
