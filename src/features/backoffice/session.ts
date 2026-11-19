import { useEffect, useState } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type SessionState = { status: 'loading'; session: null } | { status: 'ready'; session: Session | null };

/** Sesión de Supabase Auth, actualizada con cada evento (inicio, cierre, recuperación…). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    let active = true;
    let gotEvent = false; // un evento posterior manda sobre el resultado de getSession
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      gotEvent = true;
      if (active) setState({ status: 'ready', session });
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      if (active && !gotEvent) setState({ status: 'ready', session: current.session });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export type BackofficeRole = 'owner' | 'staff';

/** Rol del usuario de la sesión en la zona privada (RLS solo le deja leer su propia fila). */
export function useBackofficeRole(userId: string | undefined) {
  return useQuery({
    queryKey: ['backoffice-role', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async (): Promise<BackofficeRole | null> => {
      const { data, error } = await supabase
        .from('backoffice_users')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const role = (data as { role: string } | null)?.role;
      return role === 'owner' || role === 'staff' ? role : null;
    },
  });
}

/** Cierra la sesión y olvida los datos privados en caché (administración y panel de cocina). */
export async function signOutBackoffice(queryClient: QueryClient) {
  await supabase.auth.signOut();
  for (const key of ['admin', 'kitchen', 'backoffice-role']) queryClient.removeQueries({ queryKey: [key] });
}

/** Solo se vuelve a rutas internas de la administración (evita redirecciones abiertas). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
}
