import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useT } from '../../i18n/useT';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { useBackofficeRole, useSession } from './session';

/**
 * Guardia común de la zona privada (design D1). Sin sesión → login con `next`; con sesión pero
 * sin rol → cierra la sesión y lo explica. En la administración (`area="admin"`) el personal se
 * lleva al panel de cocina; el panel (`area="kitchen"`) admite dueño y personal.
 * La garantía real está en RLS y en las funciones del servidor.
 */
export function BackofficeGuard({ area, children }: { area: 'admin' | 'kitchen'; children: ReactNode }) {
  const t = useT();
  const location = useLocation();
  const { status, session } = useSession();
  const role = useBackofficeRole(session?.user.id);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (role.data === null) {
      setRejected(true);
      void supabase.auth.signOut();
    }
  }, [role.data]);

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

  if (role.isError) {
    return (
      <main className="page" role="alert">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void role.refetch()}>
          {t('menu.retry')}
        </button>
      </main>
    );
  }

  if (!role.data) return null;

  if (area === 'admin' && role.data === 'staff') return <Navigate to="/admin/kitchen" replace />;

  return <>{children}</>;
}
