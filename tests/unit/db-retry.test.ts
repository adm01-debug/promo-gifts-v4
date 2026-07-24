/**
 * tests/unit/db-retry.test.ts
 *
 * Suíte exaustiva do incidente 403 de 2026-07-17 e dos 5 bugs encontrados
 * pela auditoria adversarial pós-merge do PR #1731.
 *
 * 108 testes → v2 do db-retry.ts
 */
import { describe, it, expect } from 'vitest';
import {
  isPermanentDbError,
  isTransientDbError,
  dbQueryRetry,
  makeDbQueryRetry,
} from '@/lib/db-retry';

// ═══ A. Erro exato do incidente ═══════════════════════════════════════════

describe('A: erro exato do incidente 403', () => {
  const cases = [
    { message: 'permission denied for view mv_stock_velocity', code: '42501' },
    { message: 'permission denied for view mv_product_intelligence', code: '42501' },
    new Error('rest-native error: permission denied for view mv_stock_velocity'),
    new Error('rest-native error: request failed with status 403 | permission denied'),
  ];
  it.each(cases.map((e, i) => [i, e]))('#%i é permanente e nunca retenta', (_i, e) => {
    expect(isPermanentDbError(e)).toBe(true);
    expect(dbQueryRetry(0, e)).toBe(false);
  });
});

// ═══ B. Status HTTP presente apenas no texto ══════════════════════════════

describe('B: status no texto (coderabbit Major)', () => {
  it.each([
    ['failed to fetch: 403', true],
    ['HTTP 401 Unauthorized', true],
    ['404 Not Found', true],
    ['422 Unprocessable Entity', true],
    ['failed: 403 service returned 503', true], // 4xx vence 5xx
  ])('"%s" é permanente=%s', (msg, perm) => {
    expect(isPermanentDbError(new Error(msg))).toBe(perm);
    expect(dbQueryRetry(0, new Error(msg))).toBe(false);
  });

  it.each([
    '500 Internal Server Error',
    '503 Service Unavailable',
    '504 Gateway Timeout',
  ])('"%s" é transitório e retenta', (msg) => {
    expect(isTransientDbError(new Error(msg))).toBe(true);
    expect(dbQueryRetry(0, new Error(msg))).toBe(true);
  });
});

// ═══ C. Word boundary — UUID traps ════════════════════════════════════════

describe('C: UUID contendo dígitos de status', () => {
  it('4403 dentro de UUID não vira permanente', () => {
    const e = new Error('product a4035bc1-0000-4403-9999-000000000000');
    expect(isPermanentDbError(e)).toBe(false);
  });

  it('403 com word boundary é reconhecido', () => {
    expect(isPermanentDbError(new Error('status 403 forbidden'))).toBe(true);
  });

  it('PGRST2059 via code não casa PGRST205', () => {
    expect(isPermanentDbError({ code: 'PGRST2059', message: 'x' })).toBe(false);
  });
});

// ═══ D. Códigos PGRST ════════════════════════════════════════════════════

describe('D: códigos PGRST', () => {
  it.each([
    [{ code: 'PGRST205', message: 'table not found' }, true],
    [{ code: 'PGRST301', message: 'JWT invalid' }, true],
    [{ code: 'PGRST302', message: 'JWT expired' }, true],
  ])('PGRST permanente: %j', (e, perm) => {
    expect(isPermanentDbError(e)).toBe(perm);
    expect(dbQueryRetry(0, e)).toBe(false);
  });

  it.each([
    { code: 'PGRST002', message: 'schema cache rebuilding' },
    { code: 'PGRST001', message: 'db connection failed' },
  ])('PGRST transitório: $code', (e) => {
    expect(isTransientDbError(e)).toBe(true);
    expect(dbQueryRetry(0, e)).toBe(true);
  });
});

// ═══ E. Supabase error shapes ═════════════════════════════════════════════

describe('E: shapes reais do Supabase client', () => {
  it.each([
    [{ code: '42501', message: 'permission denied' }, true],
    [{ status: 403, message: 'Forbidden' }, true],
    [{ status: 401, message: 'Missing auth token' }, true],
    [{ statusCode: '403', message: 'JWT is required' }, true],
    [{ statusCode: 403, message: 'Forbidden' }, true],
  ])('permanente: %j', (e, perm) => {
    expect(isPermanentDbError(e)).toBe(perm);
    expect(dbQueryRetry(0, e)).toBe(false);
  });

  it.each([
    new TypeError('Failed to fetch'),
    { status: 429, message: 'Rate limit exceeded' },
    new Error('AbortError: The operation was aborted'),
    { code: 'ECONNRESET', message: 'socket hang up' },
    { status: 500, message: 'Internal Server Error' },
  ])('transitório: %j', (e) => {
    expect(isTransientDbError(e)).toBe(true);
    expect(dbQueryRetry(0, e)).toBe(true);
  });
});

// ═══ F. Não regredir comportamentos pré-existentes ════════════════════════

describe('F: comportamentos pré-existentes', () => {
  it.each([
    new Error('materialized view has not been populated'),
    new Error('tabela não mapeada pelo extdb'),
    { message: 'JWT expired', code: 'PGRST302' },
    { code: '42P01', message: 'relation "x" does not exist' },
  ])('nunca retenta: %j', (e) => {
    expect(dbQueryRetry(0, e)).toBe(false);
  });
});

// ═══ G. Teto de tentativas ════════════════════════════════════════════════

describe('G: teto de tentativas', () => {
  const netErr = new TypeError('Failed to fetch');

  it('default: retenta count 0 e 1, para no 2', () => {
    expect(dbQueryRetry(0, netErr)).toBe(true);
    expect(dbQueryRetry(1, netErr)).toBe(true);
    expect(dbQueryRetry(2, netErr)).toBe(false);
  });

  it('makeDbQueryRetry(1): nunca retenta', () => {
    const r = makeDbQueryRetry(1);
    expect(r(0, netErr)).toBe(false);
  });

  it('makeDbQueryRetry(5): retenta 0-3, para no 4', () => {
    const r = makeDbQueryRetry(5);
    expect(r(3, netErr)).toBe(true);
    expect(r(4, netErr)).toBe(false);
  });
});

// ═══ H. Fuzz / entradas degeneradas ═══════════════════════════════════════

describe('H: entradas degeneradas não explodem', () => {
  it.each([null, undefined, 0, '', false, true, [], {}, new Error('')])(
    'não explode com %p',
    (e) => {
      expect(() => isPermanentDbError(e)).not.toThrow();
      expect(() => isTransientDbError(e)).not.toThrow();
      expect(() => dbQueryRetry(0, e)).not.toThrow();
    },
  );

  it('status como string "403" não conta (precisa ser number)', () => {
    expect(isPermanentDbError({ status: '403' })).toBe(false);
  });

  it('statusCode como string "403" conta (Supabase Storage)', () => {
    expect(isPermanentDbError({ statusCode: '403' })).toBe(true);
  });
});

// ═══ I. Conflito 4xx + 5xx na mesma mensagem ═════════════════════════════

describe('I: 4xx sempre vence 5xx na mesma mensagem', () => {
  it.each([
    'failed to fetch: 403',
    'upstream 403 via 503',
    '503: returned 403 forbidden',
  ])('"%s" → permanente (4xx vence)', (msg) => {
    expect(isPermanentDbError(new Error(msg))).toBe(true);
    expect(isTransientDbError(new Error(msg))).toBe(false);
  });

  it('503 sozinho é transitório', () => {
    expect(isPermanentDbError(new Error('upstream 503'))).toBe(false);
    expect(isTransientDbError(new Error('upstream 503'))).toBe(true);
  });
});

// ═══ J. Pureza de makeDbQueryRetry ════════════════════════════════════════

describe('J: makeDbQueryRetry é pura (sem estado compartilhado)', () => {
  it('chamadas alternadas com erros diferentes não interferem', () => {
    const r = makeDbQueryRetry(3);
    const net = new TypeError('fetch failed');
    const perm = { status: 403 };
    expect(r(0, net)).toBe(true);
    expect(r(0, perm)).toBe(false);
    expect(r(0, net)).toBe(true); // estado não foi "contaminado" pelo perm
  });
});
