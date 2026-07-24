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
 *
 * Resiliência de persistência (fallback em cascata — CRÍTICO):
 *    localStorage  →  sessionStorage  →  memória em módulo
 *
 *  Cada nível é testado com uma sonda write/read antes de ser adotado.
 *  Nenhuma falha de storage jamais lança para o consumidor.
 *
 * Analytics opcional:
 *  - `loadCartViewMode` emite `daily_reset` quando o reset ocorre.
 *  - `persistCartViewMode` emite `change` (from → to) quando o modo troca.
 *  - O emissor é injetado — mantém este módulo puro/testável.
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
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Backend efetivo em uso (útil para telemetria e testes). */
export type StorageBackend = 'localStorage' | 'memory' | 'sessionStorage';

// Fallback em memória — dura enquanto a aba estiver aberta.
const memoryStore = new Map<string, string>();
const memoryStorage: SafeStorage = {
  getItem: (k) => (memoryStore.has(k) ? (memoryStore.get(k) ?? null) : null),
  setItem: (k, v) => {
    memoryStore.set(k, v);
  },
};

function probe(store: Storage): boolean {
  try {
    const key = '__cart_vm_probe__';
    store.setItem(key, '1');
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isLocalStorageUsable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return probe(window.localStorage);
  } catch {
    return false;
  }
}

function isSessionStorageUsable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    return probe(window.sessionStorage);
  } catch {
    return false;
  }
}

/**
 * Retorna o backend de storage atualmente utilizável, seguindo a cascata:
 * localStorage → sessionStorage → memory.
 * Exportado para telemetria e testes.
 */
export function detectStorageBackend(): StorageBackend {
  if (isLocalStorageUsable()) return 'localStorage';
  if (isSessionStorageUsable()) return 'sessionStorage';
  return 'memory';
}

function wrapStorage(store: Storage): SafeStorage {
  return {
    getItem(key) {
      try {
        return store.getItem(key);
      } catch {
        return memoryStorage.getItem(key);
      }
    },
    setItem(key, value) {
      try {
        store.setItem(key, value);
      } catch {
        // Ex.: QuotaExceededError. Sustenta a leitura via fallback em memória.
        memoryStorage.setItem(key, value);
      }
    },
  };
}

/**
 * Retorna um `SafeStorage` que NUNCA lança. Segue a cascata:
 *   localStorage disponível → localStorage
 *   senão sessionStorage disponível → sessionStorage
 *   senão → memory (Map de módulo)
 */
export function getSafeStorage(): SafeStorage {
  const backend = detectStorageBackend();
  if (backend === 'localStorage') return wrapStorage(window.localStorage);
  if (backend === 'sessionStorage') return wrapStorage(window.sessionStorage);
  return memoryStorage;
}

/**
 * Retorna o "carimbo de dia" no timezone LOCAL do usuário no formato
 * `YYYY-MM-DD`. `toISOString()` retorna em UTC — não usar aqui.
 */
export function getLocalDateStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// -----------------------------------------------------------------------------
// Analytics — emissor injetável (mantém o módulo puro/testável).
// -----------------------------------------------------------------------------

export type CartViewModeEvent =
  {
      type: 'change';
      uid: string;
      from: CartViewMode | null;
      to: CartViewMode;
      backend: StorageBackend;
    } | {
      type: 'daily_reset';
      uid: string;
      previous: CartViewMode | null;
      /** Data persistida antes do reset (pode ser null se não havia registro). */
      previousDate: string | null;
      /** Data local corrente que motivou o reset. */
      today: string;
      backend: StorageBackend;
    };

export type CartViewModeEventEmitter = (event: CartViewModeEvent) => void;

const noopEmitter: CartViewModeEventEmitter = () => {};

// -----------------------------------------------------------------------------

export interface LoadCartViewModeResult {
  viewMode: CartViewMode;
  /** true quando o modo foi resetado por ser primeiro acesso do dia. */
  reset: boolean;
  /** Backend em uso — útil para telemetria e diagnóstico. */
  backend: StorageBackend;
}

export interface LoadOptions {
  storage?: SafeStorage;
  now?: Date;
  emit?: CartViewModeEventEmitter;
  backend?: StorageBackend;
}

/**
 * Carrega o viewMode persistido para o `uid`. Se a data persistida for
 * diferente do dia local corrente (ou não existir), reseta para "list"
 * e regrava as chaves com a data de hoje. Emite `daily_reset` neste caso.
 */
export function loadCartViewMode(uid: string, options: LoadOptions = {}): LoadCartViewModeResult {
  const backend = options.backend ?? detectStorageBackend();
  const storage = options.storage ?? getSafeStorage();
  const now = options.now ?? new Date();
  const emit = options.emit ?? noopEmitter;

  const today = getLocalDateStamp(now);
  const storedDate = storage.getItem(cartViewModeDateStorageKey(uid));
  const rawStoredMode = storage.getItem(cartViewModeStorageKey(uid));
  const storedMode: CartViewMode | null = isCartViewMode(rawStoredMode) ? rawStoredMode : null;

  if (storedDate === today && storedMode) {
    return { viewMode: storedMode, reset: false, backend };
  }

  storage.setItem(cartViewModeStorageKey(uid), CART_VIEW_MODE_DEFAULT);
  storage.setItem(cartViewModeDateStorageKey(uid), today);

  emit({
    type: 'daily_reset',
    uid,
    previous: storedMode,
    previousDate: storedDate,
    today,
    backend,
  });

  return { viewMode: CART_VIEW_MODE_DEFAULT, reset: true, backend };
}

export interface PersistOptions {
  storage?: SafeStorage;
  now?: Date;
  emit?: CartViewModeEventEmitter;
  backend?: StorageBackend;
}

/**
 * Persiste a escolha do usuário mantendo a data local corrente. Se o valor
 * mudou (from → to), emite `change`.
 */
export function persistCartViewMode(
  uid: string,
  viewMode: CartViewMode,
  options: PersistOptions = {},
): void {
  const backend = options.backend ?? detectStorageBackend();
  const storage = options.storage ?? getSafeStorage();
  const now = options.now ?? new Date();
  const emit = options.emit ?? noopEmitter;

  const rawPrevious = storage.getItem(cartViewModeStorageKey(uid));
  const previous: CartViewMode | null = isCartViewMode(rawPrevious) ? rawPrevious : null;

  storage.setItem(cartViewModeStorageKey(uid), viewMode);
  storage.setItem(cartViewModeDateStorageKey(uid), getLocalDateStamp(now));

  if (previous !== viewMode) {
    emit({ type: 'change', uid, from: previous, to: viewMode, backend });
  }
}
