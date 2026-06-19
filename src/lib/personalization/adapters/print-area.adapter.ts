/**
 * Print area adapter — Normaliza linhas brutas de `print_area_techniques`
 * (e tabelas correlatas) para um formato consistente.
 *
 * Hoje os principais consumidores (`fetchPrintAreasFromProduct`,
 * `simulationPriceFetcher`) já fazem essa normalização ad-hoc; isolamos a
 * lógica de aliasing em um único lugar para que a evolução do schema do back
 * (PT → EN) não exija caçar consumidores.
 */

type Raw = Record<string, unknown>;

export interface NormalizedPrintAreaRow {
  id: string;
  product_id: string;
  area_code: string;
  area_name: string | null;
  location_code: string | null;
  location_name: string | null;
  max_width: number;
  max_height: number;
  shape: string;
  is_curved: boolean;
  is_active: boolean;
  technique_order: number;
  tabela_preco_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function pick<T = unknown>(obj: Raw, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return fallback;
}

export function adaptPrintAreaRow(raw: Raw, productId: string, idx = 0): NormalizedPrintAreaRow {
  return {
    id: String(pick(raw, 'id') ?? `${productId}-area-${idx}`),
    product_id: productId,
    area_code: String(pick(raw, 'area_code', 'location_code', 'code') ?? ''),
    area_name: pick<string>(raw, 'area_name', 'name') ?? null,
    location_code: pick<string>(raw, 'location_code') ?? null,
    location_name: pick<string>(raw, 'location_name') ?? null,
    max_width: toNumber(pick(raw, 'max_width', 'largura_max')),
    max_height: toNumber(pick(raw, 'max_height', 'altura_max')),
    shape: String(pick(raw, 'shape') ?? 'rectangle'),
    is_curved: toBool(pick(raw, 'is_curved', 'curved')),
    is_active: toBool(pick(raw, 'is_active', 'ativo'), true),
    technique_order: toNumber(pick(raw, 'technique_order', 'display_order', 'order'), idx),
    tabela_preco_id: pick<string>(raw, 'tabela_preco_id', 'price_table_id') ?? null,
  };
}

export function adaptPrintAreaRows(rows: Raw[], productId: string): NormalizedPrintAreaRow[] {
  return rows.map((r, idx) => adaptPrintAreaRow(r, productId, idx));
}
