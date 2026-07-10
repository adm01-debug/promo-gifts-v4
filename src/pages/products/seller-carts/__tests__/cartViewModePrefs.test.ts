/**
 * Testes das preferências de viewMode dos carrinhos do vendedor.
 *
 * Cobertura:
 *  1. Primeiro acesso do dia reseta para "list".
 *  2. Preferência escolhida é mantida durante o mesmo dia.
 *  3. Timezone local (não UTC).
 *  4. Isolamento por uid.
 *  5. Resiliência: localStorage bloqueado → sessionStorage → memória.
 *  6. Emissor de analytics (`change` e `daily_reset`).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CART_VIEW_MODE_DEFAULT,
  type CartViewModeEvent,
  cartViewModeDateStorageKey,
  cartViewModeStorageKey,
  detectStorageBackend,
  getLocalDateStamp,
  getSafeStorage,
  loadCartViewMode,
  persistCartViewMode,
} from '../cartViewModePrefs';

const UID_A = 'user-a';
const UID_B = 'user-b';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// -----------------------------------------------------------------------------
// getLocalDateStamp
// -----------------------------------------------------------------------------

describe('getLocalDateStamp — timezone local', () => {
  it('usa componentes de data LOCAL (não UTC)', () => {
    const now = new Date(2026, 6, 10, 23, 30, 0);
    expect(getLocalDateStamp(now)).toBe('2026-07-10');
  });

  it('formata com padding de mês/dia', () => {
    expect(getLocalDateStamp(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('não depende de toISOString (UTC)', () => {
    const localNight = new Date(2026, 0, 15, 22, 0, 0);
    expect(getLocalDateStamp(localNight)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getLocalDateStamp(localNight)).toBe('2026-01-15');
  });
});

// -----------------------------------------------------------------------------
// loadCartViewMode — reset diário
// -----------------------------------------------------------------------------

describe('loadCartViewMode — primeiro acesso do dia reseta para "list"', () => {
  it('sem storage prévio, retorna "list" e grava data de hoje', () => {
    const now = new Date(2026, 6, 10, 9, 0, 0);
    const result = loadCartViewMode(UID_A, { storage: localStorage, now });

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
    expect(localStorage.getItem(cartViewModeStorageKey(UID_A))).toBe('list');
    expect(localStorage.getItem(cartViewModeDateStorageKey(UID_A))).toBe('2026-07-10');
  });

  it('com data de ONTEM + modo "grid", reseta', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'grid');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-09');

    const now = new Date(2026, 6, 10, 8, 0, 0);
    const result = loadCartViewMode(UID_A, { storage: localStorage, now });

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
  });

  it('com viewMode CORROMPIDO no storage, força reset', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'lixo-invalido');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-10');

    const now = new Date(2026, 6, 10, 9, 0, 0);
    const result = loadCartViewMode(UID_A, { storage: localStorage, now });

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// loadCartViewMode — retenção durante o dia
// -----------------------------------------------------------------------------

describe('loadCartViewMode — preferência mantida durante o mesmo dia', () => {
  it('mantém "grid" no mesmo dia', () => {
    const now = new Date(2026, 6, 10, 15, 0, 0);
    persistCartViewMode(UID_A, 'grid', { storage: localStorage, now });

    const later = new Date(2026, 6, 10, 22, 45, 0);
    const result = loadCartViewMode(UID_A, { storage: localStorage, now: later });
    expect(result.viewMode).toBe('grid');
    expect(result.reset).toBe(false);
  });

  it('alterna list → grid → table sem resetar no mesmo dia', () => {
    const day = new Date(2026, 6, 10, 9, 0, 0);
    persistCartViewMode(UID_A, 'grid', { storage: localStorage, now: day });
    expect(loadCartViewMode(UID_A, { storage: localStorage, now: day }).viewMode).toBe('grid');

    persistCartViewMode(UID_A, 'table', { storage: localStorage, now: day });
    expect(loadCartViewMode(UID_A, { storage: localStorage, now: day }).viewMode).toBe('table');
  });
});

// -----------------------------------------------------------------------------
// Isolamento por uid
// -----------------------------------------------------------------------------

describe('Isolamento por uid — sem conflito entre contas', () => {
  it('preferências de user-a não afetam user-b', () => {
    const now = new Date(2026, 6, 10, 12, 0, 0);
    persistCartViewMode(UID_A, 'grid', { storage: localStorage, now });
    persistCartViewMode(UID_B, 'table', { storage: localStorage, now });

    expect(loadCartViewMode(UID_A, { storage: localStorage, now }).viewMode).toBe('grid');
    expect(loadCartViewMode(UID_B, { storage: localStorage, now }).viewMode).toBe('table');
  });

  it('reset diário de user-a não reseta user-b', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'grid');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-09');
    const today = new Date(2026, 6, 10, 8, 0, 0);
    persistCartViewMode(UID_B, 'table', { storage: localStorage, now: today });

    const rA = loadCartViewMode(UID_A, { storage: localStorage, now: today });
    const rB = loadCartViewMode(UID_B, { storage: localStorage, now: today });

    expect(rA.viewMode).toBe('list');
    expect(rB.viewMode).toBe('table');
  });

  it('formato de chaves: `<key>:<uid>`', () => {
    expect(cartViewModeStorageKey('abc')).toBe('cart-view-mode:abc');
    expect(cartViewModeDateStorageKey('abc')).toBe('cart-view-mode-date:abc');
  });
});

// -----------------------------------------------------------------------------
// SSOT
// -----------------------------------------------------------------------------

describe('SSOT', () => {
  it('CART_VIEW_MODE_DEFAULT === "list"', () => {
    expect(CART_VIEW_MODE_DEFAULT).toBe('list');
  });
});

// -----------------------------------------------------------------------------
// Resiliência: cascata localStorage → sessionStorage → memória
// -----------------------------------------------------------------------------

describe('Cascata de storage — localStorage → sessionStorage → memória', () => {
  let lsDescriptor: PropertyDescriptor | undefined;
  let ssDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    lsDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    ssDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  });

  afterEach(() => {
    if (lsDescriptor) Object.defineProperty(window, 'localStorage', lsDescriptor);
    if (ssDescriptor) Object.defineProperty(window, 'sessionStorage', ssDescriptor);
    vi.restoreAllMocks();
  });

  const blockStorage = (name: 'localStorage' | 'sessionStorage') => {
    Object.defineProperty(window, name, {
      configurable: true,
      get: () => {
        throw new DOMException('SecurityError', 'SecurityError');
      },
    });
  };

  it('detectStorageBackend retorna "localStorage" quando tudo disponível', () => {
    expect(detectStorageBackend()).toBe('localStorage');
  });

  it('cai para sessionStorage quando localStorage lança', () => {
    blockStorage('localStorage');
    expect(detectStorageBackend()).toBe('sessionStorage');

    const safe = getSafeStorage();
    safe.setItem('cart-view-mode:u1', 'grid');
    expect(sessionStorage.getItem('cart-view-mode:u1')).toBe('grid');
    expect(safe.getItem('cart-view-mode:u1')).toBe('grid');
  });

  it('cai para memória quando localStorage E sessionStorage lançam', () => {
    blockStorage('localStorage');
    blockStorage('sessionStorage');
    expect(detectStorageBackend()).toBe('memory');

    const safe = getSafeStorage();
    expect(() => safe.setItem('cart-view-mode:u2', 'table')).not.toThrow();
    expect(safe.getItem('cart-view-mode:u2')).toBe('table');
  });

  it('ciclo completo em sessionStorage: reset diário + persistência', () => {
    blockStorage('localStorage');
    const safe = getSafeStorage();
    const day = new Date(2026, 6, 10, 9, 0, 0);

    const first = loadCartViewMode('u-ss', { storage: safe, now: day });
    expect(first.viewMode).toBe('list');
    expect(first.reset).toBe(true);

    persistCartViewMode('u-ss', 'grid', { storage: safe, now: day });
    const second = loadCartViewMode('u-ss', { storage: safe, now: day });
    expect(second.viewMode).toBe('grid');
    expect(second.reset).toBe(false);

    // sessionStorage é o backend real neste caso
    expect(sessionStorage.getItem('cart-view-mode:u-ss')).toBe('grid');
  });

  it('ciclo completo em memória (ambos bloqueados)', () => {
    blockStorage('localStorage');
    blockStorage('sessionStorage');
    const safe = getSafeStorage();
    const day = new Date(2026, 6, 10, 9, 0, 0);

    const first = loadCartViewMode('u-mem', { storage: safe, now: day });
    expect(first.viewMode).toBe('list');

    persistCartViewMode('u-mem', 'grid', { storage: safe, now: day });
    const second = loadCartViewMode('u-mem', { storage: safe, now: day });
    expect(second.viewMode).toBe('grid');

    // Nem ls nem ss têm o valor — memory-only.
    // (getters bloqueados; leitura fora do wrapper cairia; usamos o wrapper.)
    expect(safe.getItem('cart-view-mode:u-mem')).toBe('grid');
  });

  it('quando setItem lança QuotaExceededError, fallback em memória mantém leitura', () => {
    const fakeLS: Storage = {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => fakeLS,
    });

    // Backend será "sessionStorage" (a sonda de localStorage falha).
    const safe = getSafeStorage();
    expect(() => safe.setItem('cart-view-mode:u3', 'grid')).not.toThrow();
    expect(safe.getItem('cart-view-mode:u3')).toBe('grid');
  });
});

// -----------------------------------------------------------------------------
// Analytics — emissor injetado
// -----------------------------------------------------------------------------

describe('Analytics — emissor de eventos', () => {
  it('emite `daily_reset` quando o modo é resetado no primeiro acesso', () => {
    const events: CartViewModeEvent[] = [];
    const day = new Date(2026, 6, 10, 9, 0, 0);
    loadCartViewMode(UID_A, { storage: localStorage, now: day, emit: (e) => events.push(e) });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'daily_reset',
      uid: UID_A,
      previous: null,
      previousDate: null,
      today: '2026-07-10',
    });
  });

  it('emite `daily_reset` com previous/previousDate quando reseta de outro dia', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'grid');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-09');

    const events: CartViewModeEvent[] = [];
    const day = new Date(2026, 6, 10, 9, 0, 0);
    loadCartViewMode(UID_A, { storage: localStorage, now: day, emit: (e) => events.push(e) });

    expect(events[0]).toMatchObject({
      type: 'daily_reset',
      uid: UID_A,
      previous: 'grid',
      previousDate: '2026-07-09',
      today: '2026-07-10',
    });
  });

  it('NÃO emite `daily_reset` quando o modo é mantido no mesmo dia', () => {
    const day = new Date(2026, 6, 10, 9, 0, 0);
    persistCartViewMode(UID_A, 'grid', { storage: localStorage, now: day });

    const events: CartViewModeEvent[] = [];
    loadCartViewMode(UID_A, { storage: localStorage, now: day, emit: (e) => events.push(e) });

    expect(events).toHaveLength(0);
  });

  it('emite `change` (from → to) quando o usuário troca o modo', () => {
    const events: CartViewModeEvent[] = [];
    const day = new Date(2026, 6, 10, 9, 0, 0);

    // Inicial: sem modo (from=null)
    persistCartViewMode(UID_A, 'grid', {
      storage: localStorage,
      now: day,
      emit: (e) => events.push(e),
    });
    // Troca para "table"
    persistCartViewMode(UID_A, 'table', {
      storage: localStorage,
      now: day,
      emit: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'change', from: null, to: 'grid' });
    expect(events[1]).toMatchObject({ type: 'change', from: 'grid', to: 'table' });
  });

  it('NÃO emite `change` quando o modo é regravado com o mesmo valor', () => {
    const day = new Date(2026, 6, 10, 9, 0, 0);
    persistCartViewMode(UID_A, 'grid', { storage: localStorage, now: day });

    const events: CartViewModeEvent[] = [];
    persistCartViewMode(UID_A, 'grid', {
      storage: localStorage,
      now: day,
      emit: (e) => events.push(e),
    });

    expect(events).toHaveLength(0);
  });
});
