/**
 * Preferências de viewMode dos carrinhos do vendedor.
 *
 * Regras:
 *  - No PRIMEIRO acesso do dia, o viewMode é resetado para "list" (SSOT).
 *  - Após o usuário escolher outro modo, a preferência é mantida durante
 *    o dia enquanto ele estiver conectado.
 *  - "Dia" respeita o TIMEZONE LOCAL do usuário (não UTC), evitando reset
 *    em horário incorreto para usuários fora de UTC.
 *  - Todas as chaves são namespaced por `uid` para isolar preferências
 *    entre contas conectadas no mesmo navegador.
 */

export type CartViewMode = 'grid' | 'list' | 'table';

export const CART_VIEW_MODE_DEFAULT: CartViewMode = 'list';

const VIEW_MODE_KEY = 'cart-view-mode';
const VIEW_MODE_DATE_KEY = 'cart-view-mode-date';

export const cartViewModeStorageKey = (uid: string) => `${VIEW_MODE_KEY}:${uid}`;
export const cartViewModeDateStorageKey = (uid: string) => `${VIEW_MODE_DATE_KEY}:${uid}`;

const isCartViewMode = (v: unknown): v is CartViewMode =>
  v === 'grid' || v === 'list' || v === 'table';

/**
 * Retorna o "carimbo de dia" no timezone LOCAL do usuário no formato
 * `YYYY-MM-DD`. Usar `toISOString()` retornaria a data em UTC — o que
 * causaria reset no horário errado para usuários em fusos negativos
 * (ex.: America/Sao_Paulo à noite ainda estaria "amanhã" em UTC).
 */
export function getLocalDateStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface LoadCartViewModeResult {
  viewMode: CartViewMode;
  /** true quando o modo foi resetado por ser primeiro acesso do dia. */
  reset: boolean;
}

/**
 * Carrega o viewMode persistido para o `uid`. Se a data persistida for
 * diferente do dia local corrente (ou não existir), reseta para "list"
 * e regrava as chaves com a data de hoje.
 */
export function loadCartViewMode(
  uid: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now: Date = new Date(),
): LoadCartViewModeResult {
  const today = getLocalDateStamp(now);
  const storedDate = storage.getItem(cartViewModeDateStorageKey(uid));
  const storedMode = storage.getItem(cartViewModeStorageKey(uid));

  if (storedDate === today && isCartViewMode(storedMode)) {
    return { viewMode: storedMode, reset: false };
  }

  storage.setItem(cartViewModeStorageKey(uid), CART_VIEW_MODE_DEFAULT);
  storage.setItem(cartViewModeDateStorageKey(uid), today);
  return { viewMode: CART_VIEW_MODE_DEFAULT, reset: true };
}

/**
 * Persiste a escolha do usuário mantendo a data local corrente,
 * de forma que a preferência permaneça pelo resto do dia.
 */
export function persistCartViewMode(
  uid: string,
  viewMode: CartViewMode,
  storage: Pick<Storage, 'setItem'> = localStorage,
  now: Date = new Date(),
): void {
  storage.setItem(cartViewModeStorageKey(uid), viewMode);
  storage.setItem(cartViewModeDateStorageKey(uid), getLocalDateStamp(now));
}
