/**
 * useRuptureHorizon — testes de migração de chave de localStorage.
 *
 * Valida o fallback de leitura:
 *  • lê v1 quando presente;
 *  • cai para chave legada `stock.ruptureHorizon` quando v1 ausente,
 *    promovendo o valor para v1 e removendo a legada (migração one-shot);
 *  • escreve novos valores SOMENTE na chave v1 (legada nunca recebe writes).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readPersistedRuptureHorizon,
  RUPTURE_HORIZON_LEGACY_KEY,
  RUPTURE_HORIZON_STORAGE_KEY,
} from '@/hooks/stock/useRuptureHorizon';

describe('useRuptureHorizon — storage migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('retorna default (3) quando nada está persistido', () => {
    expect(readPersistedRuptureHorizon()).toBe(3);
  });

  it('lê valor da chave v1 quando presente', () => {
    window.localStorage.setItem(RUPTURE_HORIZON_STORAGE_KEY, '15');
    expect(readPersistedRuptureHorizon()).toBe(15);
  });

  it('migra valor da chave legada para v1 e remove a legada', () => {
    window.localStorage.setItem(RUPTURE_HORIZON_LEGACY_KEY, '7');
    expect(readPersistedRuptureHorizon()).toBe(7);
    expect(window.localStorage.getItem(RUPTURE_HORIZON_STORAGE_KEY)).toBe('7');
    expect(window.localStorage.getItem(RUPTURE_HORIZON_LEGACY_KEY)).toBeNull();
  });

  it('v1 tem precedência sobre legada (não migra quando v1 já existe)', () => {
    window.localStorage.setItem(RUPTURE_HORIZON_STORAGE_KEY, '30');
    window.localStorage.setItem(RUPTURE_HORIZON_LEGACY_KEY, '7');
    expect(readPersistedRuptureHorizon()).toBe(30);
    // Legada não deve ser tocada quando v1 vence.
    expect(window.localStorage.getItem(RUPTURE_HORIZON_LEGACY_KEY)).toBe('7');
  });

  it('rejeita valores inválidos na chave v1 e cai para default', () => {
    window.localStorage.setItem(RUPTURE_HORIZON_STORAGE_KEY, '999');
    expect(readPersistedRuptureHorizon()).toBe(3);
  });

  it('rejeita valores inválidos na chave legada e cai para default', () => {
    window.localStorage.setItem(RUPTURE_HORIZON_LEGACY_KEY, 'abc');
    expect(readPersistedRuptureHorizon()).toBe(3);
  });
});
