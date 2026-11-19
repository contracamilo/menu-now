import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { orderReducer, type DraftOrder, type NewLine, type OrderAction } from './orderReducer';
import { readDraft, writeDraft } from './orderStorage';

export interface OrderContextValue {
  token: string;
  draft: DraftOrder;
  dispatch: (action: OrderAction) => void;
  add: (line: Omit<NewLine, 'key'>) => void;
  /** Último mensaje para la región viva (spec «Accesibilidad del pedido»). */
  announcement: string;
  announce: (message: string) => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** Pedido sin confirmar de una mesa, conservado en el móvil (design D7). Móntese con `key={token}`. */
export function OrderProvider({ token, children }: { token: string; children: ReactNode }) {
  const [draft, dispatch] = useReducer(orderReducer, token, readDraft);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    writeDraft(token, draft);
  }, [token, draft]);

  const add = useCallback((line: Omit<NewLine, 'key'>) => dispatch({ type: 'add', line: { ...line, key: newKey() } }), []);

  // Un espacio de no separación alterna el texto para que se anuncie aunque se repita el mensaje
  const announce = useCallback(
    (message: string) => setAnnouncement((previous) => (previous === message ? `${message} ` : message)),
    [],
  );

  const value = useMemo(
    () => ({ token, draft, dispatch, add, announcement, announce }),
    [token, draft, add, announcement, announce],
  );
  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder(): OrderContextValue {
  const value = useContext(OrderContext);
  if (!value) throw new Error('useOrder debe usarse dentro de <OrderProvider>');
  return value;
}

/** Igual que `useOrder`, pero sin error fuera de una mesa (la carta general no tiene pedido). */
export function useOptionalOrder(): OrderContextValue | null {
  return useContext(OrderContext);
}
