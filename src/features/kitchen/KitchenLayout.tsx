import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '../../i18n/useT';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { VenueHeader } from '../venue/VenueHeader';
import { signOutBackoffice, useBackofficeRole, useSession } from '../backoffice/session';
import { useKitchenOrders, type KitchenOrdersData } from './kitchenApi';
import { statusText } from './OrderCard';
import { splitKitchenOrders } from './splitKitchenOrders';
import { useAlertSound } from './useAlertSound';
import { useKitchenRealtime, type KitchenRealtime } from './useKitchenRealtime';
import { useWakeLock } from './useWakeLock';
import type { KitchenOrder } from './types';
import '../../styles/kitchen.scss';

export interface KitchenContext {
  query: ReturnType<typeof useKitchenOrders>;
  data: KitchenOrdersData | undefined;
  active: KitchenOrder[];
  history: KitchenOrder[];
  realtime: KitchenRealtime;
}

export function useKitchen() {
  return useOutletContext<KitchenContext>();
}

/**
 * Marco del panel de cocina (design D1, D6, D7): local, pestañas con recuento, aviso de conexión,
 * botón de sonido, idioma, cierre de sesión y, solo para el dueño, vuelta a la administración.
 * Aquí viven la consulta y el canal de Realtime, compartidos por las dos pestañas.
 */
export function KitchenLayout() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const role = useBackofficeRole(session?.user.id);
  const query = useKitchenOrders();
  const sound = useAlertSound();
  const realtime = useKitchenRealtime({ onInsert: sound.play });
  useWakeLock();

  const { active, history } = useMemo(() => splitKitchenOrders(query.data?.orders ?? []), [query.data]);

  // Región viva (spec «Accesibilidad del panel»): anuncia cada pedido nuevo cuando ya se conoce su
  // número y su mesa, y cada cambio de estado, lo haga esta tablet u otro dispositivo
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(new Set<string>());
  const lastStatus = useRef<Map<string, KitchenOrder['status']> | null>(null);
  useEffect(() => {
    const orders = query.data?.orders;
    if (!orders) return;
    const messages: string[] = [];
    for (const id of realtime.newIds) {
      if (announced.current.has(id)) continue;
      const order = orders.find((o) => o.id === id);
      if (!order) continue;
      announced.current.add(id);
      messages.push(t('kitchen.newOrder', { number: order.number, table: order.table_name }));
    }
    const previous = lastStatus.current;
    if (previous) {
      for (const order of orders) {
        const before = previous.get(order.id);
        if (before && before !== order.status) {
          messages.push(t('kitchen.statusChanged', { number: order.number, status: statusText(t, order.status) }));
        }
      }
    }
    lastStatus.current = new Map(orders.map((o) => [o.id, o.status]));
    if (messages.length > 0) setAnnouncement(messages.join(' '));
  }, [realtime.newIds, query.data, t]);

  async function signOut() {
    await signOutBackoffice(queryClient);
    navigate('/admin/login', { replace: true });
  }

  const context: KitchenContext = { query, data: query.data, active, history, realtime };

  return (
    // Cualquier toque en el panel reanuda el audio que el navegador mantiene suspendido (D7)
    <div className="kitchen" onPointerDown={sound.resume} onKeyDown={sound.resume}>
      {realtime.offline && (
        <p role="alert" className="kitchen-offline">
          {t('kitchen.offline')}
        </p>
      )}
      <div className="kitchen__top">
        <VenueHeader asHeading={false} />
        <div className="admin-bar">
          {sound.suspended && (
            <button type="button" className="button tap-target button--primary" onClick={sound.resume}>
              {t('kitchen.enableSound')}
            </button>
          )}
          <LanguageSwitcher />
          {role.data === 'owner' && (
            <Link className="button tap-target" to="/admin">
              {t('kitchen.backToAdmin')}
            </Link>
          )}
          <button type="button" className="button tap-target" onClick={() => void signOut()}>
            {t('auth.signOut')}
          </button>
        </div>
        <h1 className="kitchen__title">{t('kitchen.title')}</h1>
        <nav className="kitchen-tabs" aria-label={t('kitchen.title')}>
          <NavLink className="kitchen-tabs__tab tap-target" to="/admin/kitchen" end>
            {t('kitchen.tabActive', { count: active.length })}
          </NavLink>
          <NavLink className="kitchen-tabs__tab tap-target" to="/admin/kitchen/history">
            {t('kitchen.tabHistory', { count: history.length })}
          </NavLink>
        </nav>
      </div>
      <p className="visually-hidden" aria-live="polite" role="status">
        {announcement}
      </p>
      <Outlet context={context} />
    </div>
  );
}
