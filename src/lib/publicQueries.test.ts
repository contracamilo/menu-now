import { describe, expect, it, vi } from 'vitest';
import { earlyFetchScript, isMenuPath, tableTokenFromPath, takeEarlyTable } from './publicQueries';

const TOKEN = '00000000-0000-4000-8000-0000000000f1';

/** Ejecuta el script inline de index.html con una ruta y un `fetch` simulados. */
function runScript(pathname: string) {
  const fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  const win: Record<string, unknown> = {};
  new Function('window', 'location', 'fetch', earlyFetchScript('https://x.supabase.co', 'anon-key'))(win, { pathname }, fetch);
  const urls = (fetch.mock.calls as unknown as [string][]).map(([url]) => url);
  return { win, urls };
}

describe('earlyFetchScript (design D6)', () => {
  it('en `/` pide la carta y el local, sin mesa', () => {
    const { urls, win } = runScript('/');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/rest/v1/categories?');
    expect(urls[1]).toContain('/rest/v1/venue_settings?');
    expect(win.__menuNowEarlyTable).toBeUndefined();
  });

  it('en `/t/<token>` pide también la mesa con ese token', () => {
    const { urls, win } = runScript(`/t/${TOKEN}`);
    expect(urls).toHaveLength(3);
    expect(urls[2]).toBe(`https://x.supabase.co/rest/v1/rpc/get_table?p_token=${TOKEN}`);
    expect((win.__menuNowEarlyTable as { token: string }).token).toBe(TOKEN);
  });

  it.each(['/t/no-es-un-token', '/admin', '/admin/login', `/x/t/${TOKEN}`])('en %s no pide nada', (path) => {
    expect(runScript(path).urls).toHaveLength(0);
  });
});

describe('rutas de la carta', () => {
  it('reconoce el token de una mesa, también en sus subrutas', () => {
    expect(tableTokenFromPath(`/t/${TOKEN}`)).toBe(TOKEN);
    expect(tableTokenFromPath(`/t/${TOKEN}/order`)).toBe(TOKEN);
    expect(tableTokenFromPath('/t/abc')).toBeNull();
    expect(isMenuPath('/')).toBe(true);
    expect(isMenuPath('/admin')).toBe(false);
  });

  it('la app solo recoge la petición temprana de la misma mesa, y una sola vez', async () => {
    const rows = Promise.resolve([{ name: 'Mesa 1', active: true }]);
    (window as unknown as Record<string, unknown>).__menuNowEarlyTable = { token: TOKEN, rows };
    expect(takeEarlyTable('11111111-1111-4111-8111-111111111111')).toBeUndefined();
    (window as unknown as Record<string, unknown>).__menuNowEarlyTable = { token: TOKEN, rows };
    expect(await takeEarlyTable(TOKEN)).toEqual([{ name: 'Mesa 1', active: true }]);
    expect(takeEarlyTable(TOKEN)).toBeUndefined();
  });
});
