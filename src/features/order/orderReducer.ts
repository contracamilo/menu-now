import type { DraftLine, PriceChange, UnavailableLine } from '../../lib/types';

export const MAX_QUANTITY = 20;
export const NOTE_MAX = 140;

/**
 * Pedido sin confirmar (design D7). `orderId` identifica el intento de envío para que el servidor
 * no registre dos veces el mismo pedido: se fija al confirmar y se descarta con cualquier cambio.
 */
export interface DraftOrder {
  orderId: string | null;
  lines: DraftLine[];
}

export type NewLine = Omit<DraftLine, 'quantity' | 'note'>;

export type OrderAction =
  | { type: 'add'; line: NewLine }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'setNote'; key: string; note: string }
  | { type: 'remove'; key: string }
  | { type: 'applyRejection'; unavailable: UnavailableLine[]; priceChanges: PriceChange[] }
  | { type: 'setOrderId'; orderId: string }
  | { type: 'clear' };

export const emptyDraft: DraftOrder = { orderId: null, lines: [] };

const clamp = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
const withLines = (lines: DraftLine[]): DraftOrder => ({ orderId: null, lines });

export function orderReducer(state: DraftOrder, action: OrderAction): DraftOrder {
  switch (action.type) {
    case 'add': {
      const { line } = action;
      // Mismo plato y tamaño sin nota: suma una unidad; si no, una línea nueva
      const existing = state.lines.find((l) => l.dish_id === line.dish_id && l.size_id === line.size_id && !l.note);
      if (existing) {
        if (existing.quantity >= MAX_QUANTITY) return state;
        return withLines(state.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)));
      }
      return withLines([...state.lines, { ...line, quantity: 1, note: '' }]);
    }
    case 'setQuantity':
      return withLines(state.lines.map((l) => (l.key === action.key ? { ...l, quantity: clamp(action.quantity) } : l)));
    case 'setNote':
      return withLines(state.lines.map((l) => (l.key === action.key ? { ...l, note: action.note.slice(0, NOTE_MAX) } : l)));
    case 'remove':
      return withLines(state.lines.filter((l) => l.key !== action.key));
    case 'applyRejection': {
      const gone = new Set(action.unavailable.map((u) => `${u.dish_id}:${u.size_id}`));
      const prices = new Map(action.priceChanges.map((p) => [`${p.dish_id}:${p.size_id}`, p.price_cents]));
      return withLines(
        state.lines
          .filter((l) => !gone.has(`${l.dish_id}:${l.size_id}`))
          .map((l) => {
            const price = prices.get(`${l.dish_id}:${l.size_id}`);
            return price === undefined ? l : { ...l, unit_price_cents: price };
          }),
      );
    }
    case 'setOrderId':
      return { ...state, orderId: action.orderId };
    case 'clear':
      return emptyDraft;
  }
}

export const lineTotal = (line: Pick<DraftLine, 'quantity' | 'unit_price_cents'>) => line.quantity * line.unit_price_cents;
export const orderTotal = (lines: DraftLine[]) => lines.reduce((sum, line) => sum + lineTotal(line), 0);
export const unitCount = (lines: DraftLine[]) => lines.reduce((sum, line) => sum + line.quantity, 0);

/** «Croquetas · Ración», o solo el nombre si el tamaño no tiene nombre. */
export const lineName = (line: { dish_name: string; size_label: string | null }) =>
  line.size_label ? `${line.dish_name} · ${line.size_label}` : line.dish_name;
