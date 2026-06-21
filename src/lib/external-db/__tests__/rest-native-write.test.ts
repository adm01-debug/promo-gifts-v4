/**
 * Testes do caminho de ESCRITA REST nativo (Plano A / PR#2).
 *
 * Cobre as 6 guardas:
 *   A1 sessão autenticada → delegada ao RLS (não testável aqui; erro vira LOUD).
 *   A2 update/delete SEM filtro/id → proibido (proteção contra mutação em massa).
 *   A3 escrita sempre na tabela BASE — nunca na view v_*_public; aliases de rename.
 *   A4 `.select()` de volta; insert OK com select-back vazio (RLS de SELECT) ainda é sucesso.
 *   A5 remap EN→PT no payload (tecnicas_gravacao).
 *   + elegibilidade (whitelist) e propagação LOUD de erro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isRestNativeWriteEligible,
  executeRestNativeWrite,
  tryExecuteRestNativeWrite,
} from '../rest-native';
import type { InvokeOptions } from '../bridge';

// ── Mock chainable do supabase ────────────────────────────────────
interface Capture {
  table: string | null;
  op: 'delete' | 'insert' | 'update' | 'upsert' | null;
  payload: unknown;
  upsertOptions?: { onConflict?: string };
  eqCalls: Array<[string, unknown]>;
  selected: boolean;
}
const cap: Capture = { table: null, op: null, payload: undefined, eqCalls: [], selected: false };
let nextResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.eq = vi.fn((c: string, v: unknown) => {
    cap.eqCalls.push([c, v]);
    return chain();
  });
  builder.in = vi.fn(() => chain());
  builder.is = vi.fn(() => chain());
  builder.select = vi.fn(() => {
    cap.selected = true;
    return chain();
  });
  // awaitable
  builder.then = (resolve: (r: typeof nextResult) => unknown) => resolve(nextResult);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      cap.table = table;
      return {
        insert: (p: unknown) => {
          cap.op = 'insert';
          cap.payload = p;
          return makeBuilder();
        },
        update: (p: unknown) => {
          cap.op = 'update';
          cap.payload = p;
          return makeBuilder();
        },
        upsert: (p: unknown, opts?: { onConflict?: string }) => {
          cap.op = 'upsert';
          cap.payload = p;
          cap.upsertOptions = opts;
          return makeBuilder();
        },
        delete: () => {
          cap.op = 'delete';
          return makeBuilder();
        },
      };
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function resetCap() {
  cap.table = null;
  cap.op = null;
  cap.payload = undefined;
  cap.upsertOptions = undefined;
  cap.eqCalls = [];
  cap.selected = false;
  nextResult = { data: [], error: null };
}

describe('rest-native WRITE (Plano A)', () => {
  beforeEach(resetCap);
  afterEach(resetCap);

  // ── Elegibilidade / whitelist ───────────────────────────────
  it('elegibilidade: write em tabela whitelisted = true; fora = false; select = false', () => {
    expect(
      isRestNativeWriteEligible({ table: 'collections', operation: 'insert' } as InvokeOptions),
    ).toBe(true);
    expect(
      isRestNativeWriteEligible({
        table: 'products',
        operation: 'update',
        id: 'x',
      } as InvokeOptions),
    ).toBe(true);
    expect(
      isRestNativeWriteEligible({
        table: 'tabela_aleatoria',
        operation: 'insert',
      } as InvokeOptions),
    ).toBe(false);
    expect(
      isRestNativeWriteEligible({ table: 'products', operation: 'select' } as InvokeOptions),
    ).toBe(false);
  });

  // ── A3: tabela BASE, nunca view ─────────────────────────────
  it('A3: insert em products vai para a tabela BASE products (não v_products_public)', async () => {
    nextResult = { data: [{ id: '1', name: 'X' }], error: null };
    const r = await executeRestNativeWrite({
      table: 'products',
      operation: 'insert',
      data: { name: 'X' },
    } as InvokeOptions);
    expect(cap.table).toBe('products');
    expect(cap.op).toBe('insert');
    expect(cap.selected).toBe(true);
    expect(r.count).toBe(1);
  });

  // ── upsert: onConflict é repassado ao PostgREST (bulk import "atualizar por SKU") ──
  it('upsert: repassa onConflict ao supabase.upsert (alvo o índice único sku, não a PK)', async () => {
    nextResult = { data: [{ id: '1', sku: 'A' }], error: null };
    await executeRestNativeWrite({
      table: 'products',
      operation: 'upsert',
      data: [{ sku: 'A', name: 'X' }],
      onConflict: 'sku',
    } as InvokeOptions);
    expect(cap.op).toBe('upsert');
    expect(cap.upsertOptions).toEqual({ onConflict: 'sku' });
  });

  it('upsert: sem onConflict, NÃO passa options (cai na PK por padrão)', async () => {
    nextResult = { data: [{ id: '1' }], error: null };
    await executeRestNativeWrite({
      table: 'products',
      operation: 'upsert',
      data: [{ id: '1', name: 'X' }],
    } as InvokeOptions);
    expect(cap.op).toBe('upsert');
    expect(cap.upsertOptions).toBeUndefined();
  });

  it('A3: personalization_techniques escreve direto na própria tabela (NÃO aliasada)', async () => {
    // personalization_techniques é uma tabela real (uuid PK, colunas EN) no banco
    // canônico. Não deve ser aliasada para tecnicas_gravacao (que tem colunas PT).
    // Ver rest-native.ts "BUG A".
    nextResult = { data: [{ id: 'u1', name: 'T', is_active: true }], error: null };
    await executeRestNativeWrite({
      table: 'personalization_techniques',
      operation: 'insert',
      data: { name: 'T', is_active: true },
    } as InvokeOptions);
    expect(cap.table).toBe('personalization_techniques');
  });

  // ── A5: payload preservado em EN (tabela real, sem remap PT) ──
  it('A5: payload de personalization_techniques preserva colunas EN (name/is_active)', async () => {
    nextResult = { data: [{ id: 'u1' }], error: null };
    await executeRestNativeWrite({
      table: 'personalization_techniques',
      operation: 'insert',
      data: { name: 'Tampografia', is_active: true },
    } as InvokeOptions);
    // Colunas EN nativas — sem remap para nome/ativo.
    expect(cap.payload).toMatchObject({ name: 'Tampografia', is_active: true });
    expect(cap.payload).not.toHaveProperty('nome');
  });

  // ── A2: proteção contra mutação em massa ──────────────────────
  it('A2: update SEM filtro/id é proibido', async () => {
    await expect(
      executeRestNativeWrite({
        table: 'products',
        operation: 'update',
        data: { is_active: false },
      } as InvokeOptions),
    ).rejects.toThrow(/mass mutation guard/i);
  });

  it('A2: delete SEM filtro/id é proibido', async () => {
    await expect(
      executeRestNativeWrite({ table: 'products', operation: 'delete' } as InvokeOptions),
    ).rejects.toThrow(/mass mutation guard/i);
  });

  it('A2: update COM id é permitido e aplica eq(id)', async () => {
    nextResult = { data: [{ id: 'p1' }], error: null };
    await executeRestNativeWrite({
      table: 'products',
      operation: 'update',
      id: 'p1',
      data: { is_active: false },
    } as InvokeOptions);
    expect(cap.eqCalls).toContainEqual(['id', 'p1']);
  });

  it('A2: delete COM id aplica eq(id) e select()', async () => {
    nextResult = { data: [{ id: 'p9' }], error: null };
    await executeRestNativeWrite({
      table: 'products',
      operation: 'delete',
      id: 'p9',
    } as InvokeOptions);
    expect(cap.op).toBe('delete');
    expect(cap.eqCalls).toContainEqual(['id', 'p9']);
    expect(cap.selected).toBe(true);
  });

  // ── A4: select-back vazio ainda é sucesso ─────────────────────
  it('A4: insert com select-back vazio (RLS de SELECT) ainda é sucesso (count 0, sem throw)', async () => {
    nextResult = { data: [], error: null };
    const r = await executeRestNativeWrite({
      table: 'collections',
      operation: 'insert',
      data: { name: 'C' },
    } as InvokeOptions);
    expect(r.records).toEqual([]);
    expect(r.count).toBe(0);
  });

  // ── Propagação LOUD de erro (RLS negada) ─────────────────────
  it('erro de RLS/validação PROPAGA (LOUD), não vira no-op', async () => {
    nextResult = { data: null, error: { message: 'new row violates row-level security policy' } };
    await expect(
      tryExecuteRestNativeWrite({
        table: 'products',
        operation: 'insert',
        data: { name: 'X' },
      } as InvokeOptions),
    ).rejects.toThrow(/row-level security/);
  });

  it('tryExecuteRestNativeWrite retorna null p/ tabela não-elegível (caller decide fallback)', async () => {
    const r = await tryExecuteRestNativeWrite({
      table: 'tabela_aleatoria',
      operation: 'insert',
      data: {},
    } as InvokeOptions);
    expect(r).toBeNull();
  });

  // ── batch_insert (array) ──────────────────────────────────
  it('batch_insert envia array preservando colunas EN de personalization_techniques', async () => {
    nextResult = { data: [{ id: 'a' }, { id: 'b' }], error: null };
    await executeRestNativeWrite({
      table: 'personalization_techniques',
      operation: 'batch_insert',
      data: [{ name: 'A' }, { name: 'B' }],
    } as unknown as InvokeOptions);
    expect(Array.isArray(cap.payload)).toBe(true);
    // personalization_techniques usa colunas EN nativas — sem remap para 'nome'.
    expect((cap.payload as Array<Record<string, unknown>>)[0]).toMatchObject({ name: 'A' });
  });
});
