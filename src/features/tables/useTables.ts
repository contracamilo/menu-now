import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/** Mesa vista por el dueño (RLS «owner read tables», design D5). */
export interface AdminTable {
  id: string;
  token: string;
  name: string;
  archived_at: string | null;
}

export const tablesQueryKey = ['admin', 'tables'] as const;
export const TABLE_NAME_MAX = 20;

export class TableError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
  }
}

export async function fetchTables(): Promise<AdminTable[]> {
  const { data, error } = await supabase.from('tables').select('id,token,name,archived_at').order('name');
  if (error) throw new TableError(error.code, error.message);
  return (data ?? []) as AdminTable[];
}

export function useTables() {
  return useQuery({ queryKey: tablesQueryKey, queryFn: fetchTables, staleTime: 0 });
}

export type TableAction =
  | { kind: 'create'; name: string }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'archive' | 'reactivate'; id: string };

async function runAction(action: TableAction) {
  const query =
    action.kind === 'create'
      ? supabase.from('tables').insert({ name: action.name })
      : action.kind === 'rename'
        ? supabase.from('tables').update({ name: action.name }).eq('id', action.id)
        : supabase
            .from('tables')
            .update({ archived_at: action.kind === 'archive' ? new Date().toISOString() : null })
            .eq('id', action.id);
  const { error } = await query;
  if (error) throw new TableError(error.code, error.message);
}

export function useTableAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runAction,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tablesQueryKey }),
  });
}

/** `23505` = nombre de mesa activa repetido (índice `tables_active_name_unique`). */
export function tableErrorKey(error: unknown) {
  return error instanceof TableError && error.code === '23505' ? 'error.tableNameTaken' : 'form.saveError';
}

export const normalizeTableName = (name: string) => name.trim().toLowerCase();

/** Orden por nombre en el idioma de la interfaz, con números naturales («Mesa 2» antes de «Mesa 10»). */
export function byName(lang: string) {
  const collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' });
  return (a: AdminTable, b: AdminTable) => collator.compare(a.name, b.name);
}

/** URL que codifica el QR de la mesa (design D9). */
export function tableUrl(token: string, origin = window.location.origin) {
  return `${origin}/t/${token}`;
}
