import { defineConfig } from 'vitest/config';

// Tests de integración contra el Supabase local (`npm run db:start`), solo para lo que no se
// puede probar en SQL: Auth (alta y restablecimiento con correo en Mailpit) y límites de Storage.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
