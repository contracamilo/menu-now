import type { AdminTable } from '../features/tables/useTables';
import { fail, fakeSupabase, ok } from './fakeSupabase';

const idFilter = (filters: Array<[string, string, unknown]>) => filters.find(([, column]) => column === 'id')?.[2];
const norm = (name: string) => name.trim().toLowerCase();

/**
 * Mesas en memoria detrás del cliente falso, con las reglas de la base de datos que ve la
 * interfaz: nombre activo único (23505) y token que no cambia al renombrar.
 */
export function installTables(initial: AdminTable[]) {
  const state: AdminTable[] = structuredClone(initial);
  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);

  const clash = (name: string, id?: string) =>
    state.some((table) => !table.archived_at && table.id !== id && norm(table.name) === norm(name));

  fakeSupabase.tables.tables = (q) => {
    if (q.op === 'select') return ok(structuredClone(state));
    const payload = q.payload as Partial<AdminTable>;
    if (q.op === 'insert') {
      if (clash(payload.name!)) return fail('duplicate', '23505');
      state.push({ id: `mesa-${state.length + 1}`, token: `token-${state.length + 1}`, archived_at: null, name: payload.name! });
    }
    if (q.op === 'update') {
      const table = state.find((candidate) => candidate.id === idFilter(q.filters))!;
      const next = { ...table, ...payload };
      if (!next.archived_at && clash(next.name, table.id)) return fail('duplicate', '23505');
      Object.assign(table, payload);
    }
    return ok(null);
  };
  return state;
}

export const table = (partial: Partial<AdminTable> & Pick<AdminTable, 'id' | 'name'>): AdminTable => ({
  token: `token-${partial.id}`,
  archived_at: null,
  ...partial,
});
