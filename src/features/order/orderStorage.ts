import type { DraftLine } from '../../lib/types';
import { emptyDraft, type DraftOrder } from './orderReducer';

// Persistencia en el móvil (design D4 y D7), por mesa. No contiene ningún dato personal.
// Si el almacenamiento no está disponible, se recuerda en memoria mientras dure la pestaña.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

const draftKey = (token: string) => `menu-now.draft.${token}`;
const ordersKey = (token: string) => `menu-now.orders.${token}`;

const isLine = (value: unknown): value is DraftLine => {
  const line = value as DraftLine;
  return (
    typeof line?.key === 'string' &&
    typeof line.dish_id === 'string' &&
    typeof line.size_id === 'string' &&
    typeof line.dish_name === 'string' &&
    typeof line.unit_price_cents === 'number' &&
    typeof line.quantity === 'number' &&
    typeof line.note === 'string'
  );
};

export function readDraft(token: string): DraftOrder {
  try {
    const parsed = JSON.parse(read(draftKey(token)) ?? 'null') as Partial<DraftOrder> | null;
    if (!parsed || !Array.isArray(parsed.lines)) return emptyDraft;
    return { orderId: typeof parsed.orderId === 'string' ? parsed.orderId : null, lines: parsed.lines.filter(isLine) };
  } catch {
    return emptyDraft;
  }
}

export function writeDraft(token: string, draft: DraftOrder) {
  write(draftKey(token), JSON.stringify(draft));
}

/** Ids de los pedidos confirmados desde este móvil para esta mesa, del más reciente al más antiguo. */
export function readOrderIds(token: string): string[] {
  try {
    const parsed = JSON.parse(read(ordersKey(token)) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeOrderIds(token: string, ids: string[]) {
  write(ordersKey(token), JSON.stringify(ids));
}

export function rememberOrderId(token: string, id: string) {
  writeOrderIds(token, [id, ...readOrderIds(token).filter((existing) => existing !== id)]);
}

/** Solo para tests: olvida lo recordado en memoria. */
export function resetMemoryStorage() {
  memory.clear();
}
