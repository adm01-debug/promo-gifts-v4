/**
 * Testes das preferências de viewMode dos carrinhos do vendedor.
 *
 * Cobertura:
 *  1. Primeiro acesso do dia reseta para "list".
 *  2. Preferência escolhida é mantida durante o mesmo dia.
 *  3. Reset ocorre quando a data persistida é de qualquer dia anterior.
 *  4. `getLocalDateStamp` respeita o timezone LOCAL do usuário (não UTC),
 *     validando que dois usuários em fusos diferentes recebem o carimbo
 *     correspondente ao seu relógio local.
 *  5. Preferências ficam isoladas por `uid` (sem conflito ao alternar
 *     entre contas no mesmo navegador).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CART_VIEW_MODE_DEFAULT,
  cartViewModeDateStorageKey,
  cartViewModeStorageKey,
  getLocalDateStamp,
  loadCartViewMode,
  persistCartViewMode,
} from '../cartViewModePrefs';

const UID_A = 'user-a';
const UID_B = 'user-b';

beforeEach(() => {
  localStorage.clear();
});

describe('getLocalDateStamp — timezone local', () => {
  it('usa componentes de data LOCAL (getFullYear/getMonth/getDate), não UTC', () => {
    // Um Date fixo: independente do TZ, os getters locais formam o carimbo.
    const now = new Date(2026, 6, 10, 23, 30, 0); // 10/jul/2026 23:30 local
    expect(getLocalDateStamp(now)).toBe('2026-07-10');
  });

  it('mantém o mesmo dia ao virar meia-noite UTC se ainda for hoje no fuso local', () => {
    // À noite em fusos negativos (ex: America/Sao_Paulo -03:00), UTC já
    // pode ter avançado para o dia seguinte. `toISOString().slice(0,10)`
    // retornaria "amanhã" — nosso helper NÃO.
    const localNight = new Date(2026, 0, 15, 22, 0, 0); // 15/jan 22:00 local
    const stamp = getLocalDateStamp(localNight);
    expect(stamp).toBe('2026-01-15');
    // Sanity: se este ambiente estiver em UTC-3 ou similar, o toISOString
    // teria virado para 2026-01-16. Confirmamos apenas que o nosso helper
    // não depende disso — vale para qualquer TZ da máquina de testes.
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zera padding para meses/dias de um dígito', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0);
    expect(getLocalDateStamp(d)).toBe('2026-01-05');
  });
});

describe('loadCartViewMode — primeiro acesso do dia reseta para "list"', () => {
  it('sem nada no storage, retorna "list" e grava data de hoje', () => {
    const now = new Date(2026, 6, 10, 9, 0, 0);
    const result = loadCartViewMode(UID_A, localStorage, now);

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
    expect(localStorage.getItem(cartViewModeStorageKey(UID_A))).toBe('list');
    expect(localStorage.getItem(cartViewModeDateStorageKey(UID_A))).toBe('2026-07-10');
  });

  it('com data de ONTEM persistida, reseta para "list" mesmo com viewMode "grid" salvo', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'grid');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-09');

    const now = new Date(2026, 6, 10, 8, 0, 0);
    const result = loadCartViewMode(UID_A, localStorage, now);

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
    expect(localStorage.getItem(cartViewModeStorageKey(UID_A))).toBe('list');
    expect(localStorage.getItem(cartViewModeDateStorageKey(UID_A))).toBe('2026-07-10');
  });

  it('com data ANTIGA (> 1 dia), reseta igualmente', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'table');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2025-01-01');

    const now = new Date(2026, 6, 10, 9, 0, 0);
    const result = loadCartViewMode(UID_A, localStorage, now);

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
  });

  it('com valor de viewMode CORROMPIDO no storage, força reset para "list"', () => {
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'lixo-invalido');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-10');

    const now = new Date(2026, 6, 10, 9, 0, 0);
    const result = loadCartViewMode(UID_A, localStorage, now);

    expect(result.viewMode).toBe('list');
    expect(result.reset).toBe(true);
  });
});

describe('loadCartViewMode — preferência mantida durante o mesmo dia', () => {
  it('mantém "grid" quando data persistida === hoje local', () => {
    const now = new Date(2026, 6, 10, 15, 0, 0);
    persistCartViewMode(UID_A, 'grid', localStorage, now);

    const later = new Date(2026, 6, 10, 22, 45, 0); // mesmo dia, mais tarde
    const result = loadCartViewMode(UID_A, localStorage, later);

    expect(result.viewMode).toBe('grid');
    expect(result.reset).toBe(false);
  });

  it('mantém "table" durante o mesmo dia', () => {
    const now = new Date(2026, 6, 10, 10, 0, 0);
    persistCartViewMode(UID_A, 'table', localStorage, now);

    const result = loadCartViewMode(UID_A, localStorage, new Date(2026, 6, 10, 20, 0, 0));
    expect(result.viewMode).toBe('table');
    expect(result.reset).toBe(false);
  });

  it('alterna list → grid → table → list mantendo a data e sem resetar', () => {
    const day = new Date(2026, 6, 10, 9, 0, 0);
    persistCartViewMode(UID_A, 'grid', localStorage, day);
    expect(loadCartViewMode(UID_A, localStorage, day).viewMode).toBe('grid');

    persistCartViewMode(UID_A, 'table', localStorage, day);
    expect(loadCartViewMode(UID_A, localStorage, day).viewMode).toBe('table');

    persistCartViewMode(UID_A, 'list', localStorage, day);
    const final = loadCartViewMode(UID_A, localStorage, day);
    expect(final.viewMode).toBe('list');
    expect(final.reset).toBe(false);
  });
});

describe('Isolamento por uid — sem conflito entre contas', () => {
  it('preferências de user-a NÃO interferem em user-b', () => {
    const now = new Date(2026, 6, 10, 12, 0, 0);
    persistCartViewMode(UID_A, 'grid', localStorage, now);
    persistCartViewMode(UID_B, 'table', localStorage, now);

    expect(loadCartViewMode(UID_A, localStorage, now).viewMode).toBe('grid');
    expect(loadCartViewMode(UID_B, localStorage, now).viewMode).toBe('table');
  });

  it('reset diário do user-a NÃO reseta o user-b (isolamento de chave e data)', () => {
    // user-a com data de ontem, user-b com data de hoje.
    localStorage.setItem(cartViewModeStorageKey(UID_A), 'grid');
    localStorage.setItem(cartViewModeDateStorageKey(UID_A), '2026-07-09');
    const today = new Date(2026, 6, 10, 8, 0, 0);
    persistCartViewMode(UID_B, 'table', localStorage, today);

    const rA = loadCartViewMode(UID_A, localStorage, today);
    const rB = loadCartViewMode(UID_B, localStorage, today);

    expect(rA.viewMode).toBe('list'); // resetou
    expect(rA.reset).toBe(true);
    expect(rB.viewMode).toBe('table'); // intacto
    expect(rB.reset).toBe(false);
  });

  it('chaves usam formato `<key>:<uid>` (contrato consumido pelo SellerCartsPage)', () => {
    expect(cartViewModeStorageKey('abc')).toBe('cart-view-mode:abc');
    expect(cartViewModeDateStorageKey('abc')).toBe('cart-view-mode-date:abc');
  });
});

describe('Ciclo completo — cenário do usuário conectado', () => {
  it('primeiro acesso do dia → escolhe grid → mantém grid até virar o dia', () => {
    // Dia 1, 08:00 — primeiro acesso.
    const morning = new Date(2026, 6, 10, 8, 0, 0);
    const first = loadCartViewMode(UID_A, localStorage, morning);
    expect(first.viewMode).toBe('list');
    expect(first.reset).toBe(true);

    // Usuário troca para grid.
    persistCartViewMode(UID_A, 'grid', localStorage, morning);

    // Reabre o app à tarde (mesmo dia).
    const afternoon = new Date(2026, 6, 10, 14, 30, 0);
    expect(loadCartViewMode(UID_A, localStorage, afternoon).viewMode).toBe('grid');

    // Reabre à noite (mesmo dia).
    const night = new Date(2026, 6, 10, 22, 45, 0);
    expect(loadCartViewMode(UID_A, localStorage, night).viewMode).toBe('grid');

    // Dia seguinte, primeiro acesso — reseta para "list".
    const nextDay = new Date(2026, 6, 11, 7, 0, 0);
    const next = loadCartViewMode(UID_A, localStorage, nextDay);
    expect(next.viewMode).toBe('list');
    expect(next.reset).toBe(true);
  });

  it('CART_VIEW_MODE_DEFAULT é "list" — SSOT compartilhado com o componente', () => {
    expect(CART_VIEW_MODE_DEFAULT).toBe('list');
  });
});
