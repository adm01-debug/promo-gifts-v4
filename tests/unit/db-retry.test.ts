/**
 * tests/unit/db-retry.test.ts
 *
 * Regressão do incidente 403 de 2026-07-17: a migration 063 aplicou
 * security_invoker=true nas views de public (Phase 4) e revogou o acesso de
 * authenticated a analytics.* (Phase 5) — uma fase anulando a outra. PostgREST
 * passou a devolver 403.
 *
 * O `retry` dos hooks só parava em 'not been populated', então cada 403 era
 * retentado 3x — com ~96 produtos × 2 hooks = ~768 requests condenados.
 *
 * Invariante protegida: erro permanente NUNCA é retentado; transitório é.
 */
import { describe, it, expect } from 'vitest';
import {
  isPermanentDbError,
  isTransientDbError,
  dbQueryRetry,
  makeDbQueryRetry,
} from '@/lib/db-retry';

describe('db-retry — erros permanentes', () => {
  it('classifica o 403 do PostgREST como permanente', () => {
    const err = { message: 'permission denied for view mv_stock_velocity', code: '42501' };
    expect(isPermanentDbError(err)).toBe(true);
    expect(isTransientDbError(err)).toBe(false);
    expect(dbQueryRetry(0, err)).toBe(false);
  });

  it('reconhece o 403 mesmo embrulhado em Error pelo rest-native', () => {
    const err = new Error(
      'rest-native error (mv_stock_velocity): permission denied for view mv_stock_velocity',
    );
    expect(isPermanentDbError(err)).toBe(true);
    expect(dbQueryRetry(0, err)).toBe(false);
  });

  it('mantém a parada em MV não populada (comportamento pré-existente)', () => {
    expect(dbQueryRetry(0, new Error('materialized view has not been populated'))).toBe(false);
  });

  it('mantém a parada em tabela não mapeada (comportamento pré-existente)', () => {
    expect(dbQueryRetry(0, new Error('tabela não mapeada'))).toBe(false);
  });

  it.each([401, 403, 404, 422])('não retenta status %i', (status) => {
    expect(dbQueryRetry(0, { message: 'erro', status })).toBe(false);
  });

  it('trata status explícito como soberano sobre a mensagem', () => {
    // 'fetch' está na allowlist transitória, mas o 403 tem de vencer.
    const err = { message: 'failed to fetch', status: 403 };
    expect(isPermanentDbError(err)).toBe(true);
    expect(dbQueryRetry(0, err)).toBe(false);
  });

  it('trata PGRST205 (objeto ausente do schema cache) como permanente', () => {
    const err = { code: 'PGRST205', message: 'Could not find the table in the schema cache' };
    expect(isPermanentDbError(err)).toBe(true);
    expect(dbQueryRetry(0, err)).toBe(false);
  });
});

describe('db-retry — status HTTP presente apenas no texto', () => {
  // rest-native.ts faz `throw new Error(msg)` e descarta o status. Sem parse do
  // texto, 'failed to fetch: 403' cairia como transitório por conter 'fetch' e
  // reintroduziria o retry storm.
  it('reconhece 403 citado só na mensagem, sem campo status', () => {
    const err = new Error('failed to fetch: 403');
    expect(isPermanentDbError(err)).toBe(true);
    expect(isTransientDbError(err)).toBe(false);
    expect(dbQueryRetry(0, err)).toBe(false);
  });

  it('não confunde dígitos dentro de UUID com status HTTP', () => {
    const err = new Error('failed to fetch product a4035bc1-0000-4403-9999-000000000000');
    expect(isPermanentDbError(err)).toBe(false);
    // continua sendo falha de rede → deve retentar
    expect(dbQueryRetry(0, err)).toBe(true);
  });

  it('não lê 5xx citado no texto como permanente', () => {
    expect(dbQueryRetry(0, new Error('503 Service Unavailable'))).toBe(true);
    expect(dbQueryRetry(0, new Error('upstream 504'))).toBe(true);
  });
});

describe('db-retry — erros transitórios', () => {
  it.each([
    ['falha de rede', new TypeError('Failed to fetch')],
    ['timeout', new Error('query timeout')],
    ['gateway', new Error('503 Service Unavailable')],
  ])('retenta %s', (_nome, err) => {
    expect(isTransientDbError(err)).toBe(true);
    expect(dbQueryRetry(0, err)).toBe(true);
  });

  it.each([408, 429, 500, 502, 503, 504])('retenta status %i', (status) => {
    expect(dbQueryRetry(0, { message: 'erro', status })).toBe(true);
  });

  it('trata PGRST002 (schema cache recarregando) como transitório', () => {
    // Condição de auto-resume — já reconhecida em src/services/materialService.ts.
    const err = { code: 'PGRST002', message: 'Could not query the database for the schema cache' };
    expect(isTransientDbError(err)).toBe(true);
    expect(dbQueryRetry(0, err)).toBe(true);
  });

  it('respeita o teto de tentativas', () => {
    const err = new Error('network error');
    expect(dbQueryRetry(0, err)).toBe(true);
    expect(dbQueryRetry(1, err)).toBe(true);
    expect(dbQueryRetry(2, err)).toBe(false);
  });
});

describe('db-retry — segurança do default', () => {
  it('não retenta erro desconhecido (allowlist, não blocklist)', () => {
    expect(dbQueryRetry(0, new Error('coisa totalmente inesperada'))).toBe(false);
  });

  it.each([null, undefined, 42, {}])('não explode com entrada %p', (entrada) => {
    expect(() => isPermanentDbError(entrada)).not.toThrow();
    expect(() => isTransientDbError(entrada)).not.toThrow();
  });
});

describe('makeDbQueryRetry', () => {
  it('respeita o teto customizado usado no prefetch', () => {
    const retry = makeDbQueryRetry(2);
    expect(retry(0, new Error('network'))).toBe(true);
    expect(retry(1, new Error('network'))).toBe(false);
  });

  it('nunca retenta permanente, mesmo com teto alto', () => {
    const retry = makeDbQueryRetry(10);
    expect(retry(0, { message: 'permission denied for view x', code: '42501' })).toBe(false);
  });
});
