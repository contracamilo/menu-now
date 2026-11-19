import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { fakeSupabase } from './fakeSupabase';

// Ningún test habla con un Supabase real: todo pasa por el cliente falso.
vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('./fakeSupabase');
  return { supabase: fakeSupabase };
});

// jsdom no implementa URL.createObjectURL (vista previa de imágenes)
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:vista-previa';
  URL.revokeObjectURL = () => {};
}

vi.mock('../lib/rest', async () => {
  const { fakeSupabase } = await import('./fakeSupabase');
  return {
    restGet: (table: string, params: Record<string, string>) => fakeSupabase.restGet(table, params),
    publicImageUrl: (path: string) => `https://fake.supabase.test/storage/v1/object/public/images/${path}`,
  };
});

beforeEach(() => {
  fakeSupabase.reset();
  try {
    localStorage.clear();
  } catch {
    /* almacenamiento no disponible */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
