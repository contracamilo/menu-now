import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { kitchenOrdersKey } from './kitchenApi';

/** Tiempo sin conexión antes de avisar, para no parpadear al cargar o en reconexiones instantáneas (D6). */
export const OFFLINE_AFTER_MS = 5_000;
/** Tiempo que un pedido nuevo se muestra resaltado (D7). */
export const NEW_FOR_MS = 120_000;

export interface KitchenRealtime {
  /** Verdadero si el panel lleva más de 5 s sin poder recibir pedidos. */
  offline: boolean;
  /** Pedidos llegados por Realtime mientras el panel está abierto (resaltados como «Nuevo»). */
  newIds: ReadonlySet<string>;
  /** Quita la marca de nuevo (al pulsar «Empezar»). */
  clearNew: (id: string) => void;
}

function browserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Canal de Realtime del panel (design D5–D6). Cada evento de `orders` invalida la consulta del
 * panel; los `INSERT` además marcan el pedido como nuevo y llaman a `onInsert`. Al (volver a) estar
 * suscrito, cuando Realtime confirma que escucha la base de datos y al volver a ser visible, el
 * panel se relee para ponerse al día.
 */
export function useKitchenRealtime({ onInsert }: { onInsert?: (orderId: string) => void } = {}): KitchenRealtime {
  const queryClient = useQueryClient();
  const [subscribed, setSubscribed] = useState(false);
  const [online, setOnline] = useState(browserOnline);
  const [offline, setOffline] = useState(false);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  const clearNew = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNewIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: kitchenOrdersKey });
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const id = (payload.new as { id?: string }).id;
          if (id) {
            setNewIds((current) => new Set(current).add(id));
            clearTimeout(timers.current.get(id));
            timers.current.set(id, setTimeout(() => clearNew(id), NEW_FOR_MS));
            onInsertRef.current?.(id);
          }
        }
        refresh();
      })
      // «Subscribed to PostgreSQL»: los cambios ya llegan de verdad (puede ser después de SUBSCRIBED,
      // p. ej. con Realtime recién arrancado); se relee para no perder lo ocurrido entre medias
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') refresh();
      })
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        setSubscribed(ok);
        // También en la primera suscripción: cubre lo ocurrido entre la primera lectura y el canal
        if (ok) refresh();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onOnline = () => {
      setOnline(true);
      refresh(); // ponerse al día aunque el canal no haya llegado a cerrarse
    };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const pending = timers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      void supabase.removeChannel(channel);
    };
  }, [queryClient, clearNew]);

  const healthy = subscribed && online;
  useEffect(() => {
    if (healthy) {
      setOffline(false);
      return;
    }
    const timer = setTimeout(() => setOffline(true), OFFLINE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [healthy]);

  return { offline, newIds, clearNew };
}
