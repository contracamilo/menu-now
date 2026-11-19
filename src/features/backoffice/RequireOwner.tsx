import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useT } from '../../i18n/useT';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { useIsOwner, useSession } from './session';

/**
 * Guardia de las pantallas del dueño (design D9). Sin sesión → login con `next`; con sesión
 * pero sin rol de dueño → cierra la sesión y lo explica. La garantía real está en RLS.
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const t = useT();
  const location = useLocation();
  const { status, session } = useSession();
  const owner = useIsOwner(session?.user.id);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (owner.data === false) {
      setRejected(true);
      void supabase.auth.signOut();
    }
  }, [owner.data]);

  if (rejected) {
    return (
      <AuthLayout title={t('auth.title')}>
        <p role="alert" className="message message--error">
          {t('auth.notOwner')}
        </p>
        <Link className="tap-target" to="/admin/login">
          {t('auth.backToLogin')}
        </Link>
      </AuthLayout>
    );
  }

  if (status === 'loading') return null;

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }

  if (owner.isError) {
    return (
      <main className="page" role="alert">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void owner.refetch()}>
          {t('menu.retry')}
        </button>
      </main>
    );
  }

  if (owner.data !== true) return null;

  return <>{children}</>;
}
