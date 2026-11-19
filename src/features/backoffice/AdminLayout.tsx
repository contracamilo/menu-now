import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { VenueHeader } from '../venue/VenueHeader';
import { signOutBackoffice } from './session';

/** Marco de las pantallas del dueño: local, navegación, idioma y cierre de sesión. */
export function AdminLayout() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notice = (useLocation().state as { notice?: MessageKey } | null)?.notice;

  async function signOut() {
    await signOutBackoffice(queryClient);
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin">
      <div className="page admin-top">
        <VenueHeader asHeading={false} />
        <div className="admin-bar">
          <nav className="admin-bar__nav" aria-label={t('admin.title')}>
            <Link className="button tap-target" to="/admin">
              {t('admin.title')}
            </Link>
            <Link className="button tap-target" to="/admin/tables">
              {t('admin.tables')}
            </Link>
            <Link className="button tap-target" to="/admin/venue">
              {t('admin.venue')}
            </Link>
            <Link className="button tap-target" to="/admin/kitchen">
              {t('admin.kitchen')}
            </Link>
            <Link className="button tap-target" to="/">
              {t('admin.viewMenu')}
            </Link>
          </nav>
          <LanguageSwitcher />
          <button type="button" className="button tap-target" onClick={() => void signOut()}>
            {t('auth.signOut')}
          </button>
        </div>
        {notice && (
          <p role="status" className="message message--success">
            {t(notice)}
          </p>
        )}
      </div>
      <Outlet />
    </div>
  );
}
