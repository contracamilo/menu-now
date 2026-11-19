import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

/** ¿El usuario de la sesión es dueño? (RLS solo le deja leer su propia fila) */
export function useIsOwner(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-owner', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backoffice_users')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { role: string } | null)?.role === 'owner';
    },
  });
}

/** Solo se vuelve a rutas internas de la administración (evita redirecciones abiertas). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
}
