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
 *  - Resiliente a `localStorage` INDISPONÍVEL ou BLOQUEADO (Safari
 *    Private Mode, quota exceeded, iframe cross-origin, cookies off):
 *    falha silenciosamente e usa fallback em memória por sessão.
 */

export type CartViewMode = 'grid' | 'list' | 'table';

export const CART_VIEW_MODE_DEFAULT: CartViewMode = 'list';

const VIEW_MODE_KEY = 'cart-view-mode';
const VIEW_MODE_DATE_KEY = 'cart-view-mode-date';

export const cartViewModeStorageKey = (uid: string) => `${VIEW_MODE_KEY}:${uid}`;
export const cartViewModeDateStorageKey = (uid: string) => `${VIEW_MODE_DATE_KEY}:${uid}`;

const isCartViewMode = (v: unknown): v is CartViewMode =>
  v === 'grid' || v === 'list' || v === 'table';

/** Interface mínima que consumimos — permite injetar mocks nos testes. */
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Fallback em memória usado quando `localStorage` não está acessível.
// Escopo de módulo — dura enquanto a aba estiver aberta.
const memoryStore = new Map<string, string>();
const memoryStorage: SafeStorage = {
  getItem: (k) => (memoryStore.has(k) ? (memoryStore.get(k) ?? null) : null),
  setItem: (k, v) => {
    memoryStore.set(k, v);
  },
};

/**
 * Detecta se `localStorage` é utilizável agora (sem SecurityError/QuotaError).
 * Executa uma escrita/leitura mínima em uma chave descartável.
 */
function isLocalStorageUsable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const ls = window.localStorage;
    if (!ls) return false;
    const probe = '__cart_vm_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retorna um `SafeStorage` que NUNCA lança:
 *  - Se `localStorage` estiver disponível, delega a ele (com try/catch por chamada).
 *  - Caso contrário, cai no store em memória.
 *
 * Exportado para os testes exercerem os dois caminhos.
 */
export function getSafeStorage(): SafeStorage {
  if (!isLocalStorageUsable()) return memoryStorage;
  const ls = window.localStorage;
  return {
    getItem(key) {
      try {
        return ls.getItem(key);
      } catch {
        return memoryStorage.getItem(key);
      }
    },
    setItem(key, value) {
      try {
        ls.setItem(key, value);
      } catch {
        // Ex.: QuotaExceededError. Mantém fallback em memória para leitura
        // durante a sessão sem quebrar a UI.
        memoryStorage.setItem(key, value);
      }
    },
  };
}

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
 *
 * O `storage` default é o `getSafeStorage()`, que nunca lança — mesmo
 * quando o browser bloqueia `localStorage`.
 */
export function loadCartViewMode(
  uid: string,
  storage: SafeStorage = getSafeStorage(),
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
  storage: SafeStorage = getSafeStorage(),
  now: Date = new Date(),
): void {
  storage.setItem(cartViewModeStorageKey(uid), viewMode);
  storage.setItem(cartViewModeDateStorageKey(uid), getLocalDateStamp(now));
}
