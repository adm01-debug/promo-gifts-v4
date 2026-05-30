/**
 * REST-native WRITE path for the (retired) external-db-bridge.
 *
 * Etapa 4 (2026-05-30): the bridge is retired (kill-switch OFF = 100% REST).
 * Writes used to become a SILENT NO-OP (reportSilentEmpty('write_bridge_off')).
 * This module routes insert/update/delete/upsert/batch_insert through
 * supabase.from(<BASE table>) so RLS is the security boundary, and propagates
 * errors LOUDLY (no silent no-op).
 *
 * SECURITY:
 *  - Writes target BASE tables, NEVER the masked read views (v_*_public).
 *    products → products (NOT v_products_public); suppliers → suppliers;
 *    print_area_techniques → print_area_techniques.
 *  - Only an explicit whitelist of GESTÃO tables is writable here. RLS (PR:
 *    "gestão != vendedor") additionally restricts writes to owner/admin.
 *  - Anti-mass-mutation guard: update/delete require an id or a non-empty
 *    filter — never a table-wide mutation.
 */
import { supabase } from '@/integrations/supabase/client';
import type { InvokeOptions, InvokeResult, Operation } from './bridge';

// ── Whitelist: BASE tables writable via REST native ───────────────────
const REST_NATIVE_WRITE_TABLES = new Set<string>([
  'products',
  'suppliers',
  'product_variants',
  'product_images',
  'product_videos',
  'product_kit_components',
  'product_materials',
  'print_area_techniques',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'tecnicas_gravacao',
]);

/**
 * WRITE aliases: resolve logical/bridge names to BASE tables.
 * CRITICAL: products/suppliers/print_area_techniques are intentionally NOT
 * remapped to their v_*_public read views — writes must hit the base table.
 * Only the bridge gravação aliases are remapped (same targets as reads).
 */
const WRITE_TABLE_ALIASES: Record<string, string> = {
  tecnica_gravacao: 'tabela_preco_gravacao_oficial',
  customization_price_tiers: 'tabela_preco_gravacao_oficial_faixa',
  personalization_techniques: 'tecnicas_gravacao',
};

/**
 * Columns to drop on write per BASE table. The técnica CRUD hook generates a
 * `slug`, but the SSOT técnica table (tabela_preco_gravacao_oficial) has no
 * such column; sending it would 400. (Confirmed source: the price table.)
 */
const WRITE_DROP_COLUMNS: Record<string, Set<string>> = {
  tabela_preco_gravacao_oficial: new Set(['slug']),
};

// EN→PT column remap, scoped per BASE table (mirrors the read path).
const COLUMN_ALIASES_BY_TABLE: Record<string, Record<string, string>> = {
  tecnicas_gravacao: {
    id: 'codigo', code: 'codigo', codigo: 'codigo',
    name: 'nome', nome: 'nome', slug: 'slug',
    is_active: 'ativo', ativo: 'ativo',
    display_order: 'ordem_exibicao', ordem_exibicao: 'ordem_exibicao',
  },
};

const POSTGREST_OP_REGEX = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\.(.+)$/;

export function resolveWriteTable(table: string): string {
  return WRITE_TABLE_ALIASES[table] ?? table;
}

export function isRestNativeWriteEligible(table: string): boolean {
  return REST_NATIVE_WRITE_TABLES.has(resolveWriteTable(table));
}

function remapWriteData(table: string, d: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map) return d;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) out[map[k] ?? k] = v;
  return out;
}

function dropWriteColumns(table: string, d: Record<string, unknown>): Record<string, unknown> {
  const drop = WRITE_DROP_COLUMNS[table];
  if (!drop) return d;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (!drop.has(k)) out[k] = v;
  return out;
}

function remapFilters(table: string, filters?: Record<string, unknown>): Record<string, unknown> | undefined {
  const map = COLUMN_ALIASES_BY_TABLE[table];
  if (!map || !filters) return filters;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) out[map[k] ?? k] = v;
  return out;
}

function mapRows(table: string, rows: Record<string, unknown>[]): unknown[] {
  if (table !== 'tecnicas_gravacao') return rows;
  return rows.map((row) => ({
    ...row,
    id: row.codigo, code: row.codigo, name: row.nome,
    is_active: row.ativo, display_order: row.ordem_exibicao,
  }));
}

type RestError = { message: string };
type RestMutationResult = { data: Record<string, unknown>[] | null; error: RestError | null };

type RestMutationThenable = PromiseLike<RestMutationResult> & {
  eq(c: string, v: unknown): RestMutationThenable;
  in(c: string, v: readonly unknown[]): RestMutationThenable;
  is(c: string, v: null): RestMutationThenable;
  gte(c: string, v: unknown): RestMutationThenable;
  lte(c: string, v: unknown): RestMutationThenable;
  gt(c: string, v: unknown): RestMutationThenable;
  lt(c: string, v: unknown): RestMutationThenable;
  like(c: string, v: unknown): RestMutationThenable;
  ilike(c: string, v: unknown): RestMutationThenable;
  neq(c: string, v: unknown): RestMutationThenable;
  not(c: string, op: string, v: unknown): RestMutationThenable;
  select(cols?: string): PromiseLike<RestMutationResult>;
};

type RestWriteClient = {
  from(table: string): {
    insert(values: unknown): { select(cols?: string): PromiseLike<RestMutationResult> };
    upsert(values: unknown, options?: { onConflict?: string }): { select(cols?: string): PromiseLike<RestMutationResult> };
    update(values: unknown): RestMutationThenable;
    delete(): RestMutationThenable;
  };
};

function applyWriteFilters(q: RestMutationThenable, filters?: Record<string, unknown>): RestMutationThenable {
  if (!filters) return q;
  for (const [col, val] of Object.entries(filters)) {
    if (val === null) { q = q.is(col, null); continue; }
    if (Array.isArray(val)) { q = q.in(col, val.length === 0 ? ['__no_match__'] : val); continue; }
    if (typeof val === 'object' && val !== null) {
      const op = (val as { op?: string }).op;
      const v = (val as { value?: unknown }).value;
      if (op === 'gte') q = q.gte(col, v);
      else if (op === 'lte') q = q.lte(col, v);
      else if (op === 'gt') q = q.gt(col, v);
      else if (op === 'lt') q = q.lt(col, v);
      else if (op === 'like') q = q.like(col, v);
      else if (op === 'ilike') q = q.ilike(col, v);
      else if (op === 'neq') q = q.neq(col, v);
      else throw new Error(`rest-native write: unsupported filter op '${op}' for column '${col}'`);
      continue;
    }
    if (typeof val === 'string') {
      const m = val.match(POSTGREST_OP_REGEX);
      if (!m) { q = q.eq(col, val); continue; }
      const [, op, rest] = m;
      if (op === 'is') q = rest === 'null' ? q.is(col, null) : q.eq(col, val);
      else if (op === 'in') {
        const inner = rest.replace(/^\(/, '').replace(/\)$/, '');
        q = q.in(col, inner.split(',').map((s) => s.trim()).filter(Boolean));
      } else if (op === 'eq') q = q.eq(col, rest);
      else if (op === 'neq') q = q.neq(col, rest);
      else if (op === 'gt') q = q.gt(col, rest);
      else if (op === 'gte') q = q.gte(col, rest);
      else if (op === 'lt') q = q.lt(col, rest);
      else if (op === 'lte') q = q.lte(col, rest);
      else if (op === 'like') q = q.like(col, rest);
      else if (op === 'ilike') q = q.ilike(col, rest);
      else q = q.eq(col, val);
      continue;
    }
    q = q.eq(col, val);
  }
  return q;
}

/**
 * Execute a write (insert/update/delete/upsert/batch_insert) via PostgREST.
 * Throws LOUDLY on error (RLS denial, constraint, etc.) — never a silent no-op.
 */
export async function executeRestNativeWrite<T>(options: InvokeOptions & { onConflict?: string }): Promise<InvokeResult<T>> {
  const op: Operation = options.operation;
  if (op === 'select') throw new Error('executeRestNativeWrite: select is not a write operation');

  const logicalTable = options.table;
  const table = resolveWriteTable(logicalTable);
  if (!REST_NATIVE_WRITE_TABLES.has(table)) {
    throw new Error(
      `rest-native write: table '${logicalTable}'${table !== logicalTable ? ` (→ ${table})` : ''} ` +
      `is not allowed for writes (not in REST_NATIVE_WRITE_TABLES)`,
    );
  }

  const client = supabase as unknown as RestWriteClient;
  const selectCols = '*';
  const adapt = (d: Record<string, unknown>): Record<string, unknown> => dropWriteColumns(table, remapWriteData(table, d));

  let result: RestMutationResult;

  if (op === 'insert') {
    const data = adapt((options.data ?? {}) as Record<string, unknown>);
    result = await client.from(table).insert(data).select(selectCols);
  } else if (op === 'batch_insert') {
    const arr = Array.isArray(options.data) ? (options.data as Record<string, unknown>[]) : [];
    if (arr.length === 0) throw new Error(`rest-native write: batch_insert with empty data for ${table}`);
    const rows = arr.map(adapt);
    result = options.onConflict
      ? await client.from(table).upsert(rows, { onConflict: options.onConflict }).select(selectCols)
      : await client.from(table).insert(rows).select(selectCols);
  } else if (op === 'upsert') {
    const payload = Array.isArray(options.data)
      ? (options.data as Record<string, unknown>[]).map(adapt)
      : adapt((options.data ?? {}) as Record<string, unknown>);
    result = await client.from(table)
      .upsert(payload, options.onConflict ? { onConflict: options.onConflict } : undefined)
      .select(selectCols);
  } else if (op === 'update') {
    const hasId = typeof options.id === 'string' && options.id.length > 0;
    const hasFilters = !!options.filters && Object.keys(options.filters).length > 0;
    if (!hasId && !hasFilters) {
      throw new Error(`rest-native write: refusing unfiltered UPDATE on ${table} (anti-mass-mutation guard)`);
    }
    const data = adapt((options.data ?? {}) as Record<string, unknown>);
    let q = client.from(table).update(data);
    if (hasId) q = q.eq('id', options.id);
    q = applyWriteFilters(q, remapFilters(table, options.filters));
    result = await q.select(selectCols);
  } else if (op === 'delete') {
    const hasId = typeof options.id === 'string' && options.id.length > 0;
    const hasFilters = !!options.filters && Object.keys(options.filters).length > 0;
    if (!hasId && !hasFilters) {
      throw new Error(`rest-native write: refusing unfiltered DELETE on ${table} (anti-mass-mutation guard)`);
    }
    let q = client.from(table).delete();
    if (hasId) q = q.eq('id', options.id);
    q = applyWriteFilters(q, remapFilters(table, options.filters));
    result = await q.select(selectCols);
  } else {
    throw new Error(`rest-native write: unsupported operation '${op}'`);
  }

  if (result.error) {
    throw new Error(`rest-native write error (${table}/${op}): ${result.error.message}`);
  }
  const rows = mapRows(table, result.data ?? []) as T[];
  return { records: rows, count: rows.length };
}
