/**
 * Extração de PromisedReplenishment / ActualArrival a partir das tabelas Ouro
 * (variant_supplier_sources e stock_snapshots). Funções puras e testáveis.
 *
 * INVARIANTES:
 *   - Promessas com data inválida ou quantidade ≤ 0 são descartadas.
 *   - Chegadas com delta ≤ 0 (saída, ajuste negativo) são descartadas.
 *   - change_type='price' nunca gera ActualArrival.
 */

import type { PromisedReplenishment, ActualArrival } from './types';

/** Forma mínima esperada de uma linha de variant_supplier_sources. */
export interface SourceRow {
  id: string;
  variant_id: string | null;
  supplier_id: string | null;
  updated_at: string | null;
  next_quantity_1: number | null;
  next_date_1: string | null;
  next_quantity_2: number | null;
  next_date_2: string | null;
  next_quantity_3: number | null;
  next_date_3: string | null;
  next_quantity_4: number | null;
  next_date_4: string | null;
  next_quantity_5: number | null;
  next_date_5: string | null;
  next_quantity_6: number | null;
  next_date_6: string | null;
}

/** Forma mínima esperada de uma linha de stock_snapshots. */
export interface SnapshotRow {
  id: string;
  variant_supplier_source_id: string | null;
  supplier_id: string | null;
  variant_id: string | null;
  stock_main_old: number | null;
  stock_main_new: number | null;
  stock_other_old: number | null;
  stock_other_new: number | null;
  change_type: string | null;
  captured_at: string | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function isValidDate(s: string | null | undefined): s is string {
  if (!s || typeof s !== 'string') return false;
  if (!ISO_DATE_RE.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function normalizeDate(s: string): string {
  // canônico yyyy-mm-dd
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Converte uma source-row em até 6 PromisedReplenishment. */
export function extractPromisesFromSource(row: SourceRow): PromisedReplenishment[] {
  if (!row.variant_id || !row.supplier_id) return [];
  const observedAt = row.updated_at ?? new Date(0).toISOString();
  const slots: Array<{ slot: 1 | 2 | 3 | 4 | 5 | 6; q: number | null; d: string | null }> = [
    { slot: 1, q: row.next_quantity_1, d: row.next_date_1 },
    { slot: 2, q: row.next_quantity_2, d: row.next_date_2 },
    { slot: 3, q: row.next_quantity_3, d: row.next_date_3 },
    { slot: 4, q: row.next_quantity_4, d: row.next_date_4 },
    { slot: 5, q: row.next_quantity_5, d: row.next_date_5 },
    { slot: 6, q: row.next_quantity_6, d: row.next_date_6 },
  ];
  const promises: PromisedReplenishment[] = [];
  for (const { slot, q, d } of slots) {
    if (q == null || !Number.isFinite(q) || q <= 0) continue;
    if (!isValidDate(d)) continue;
    promises.push({
      id: `${row.id}:${slot}`,
      sourceId: row.id,
      supplierId: row.supplier_id,
      variantId: row.variant_id,
      slot,
      promisedDate: normalizeDate(d),
      promisedQuantity: Math.trunc(q),
      observedAt,
    });
  }
  return promises;
}

/** Converte snapshot-row em ActualArrival (ou null se não for chegada real). */
export function extractArrivalFromSnapshot(row: SnapshotRow): ActualArrival | null {
  if (!row.variant_supplier_source_id || !row.supplier_id || !row.variant_id) return null;
  if (!isValidDate(row.captured_at)) return null;
  // change_type 'price' não mexe em estoque
  if (row.change_type === 'price') return null;
  const oldTotal = (row.stock_main_old ?? 0) + (row.stock_other_old ?? 0);
  const newTotal = (row.stock_main_new ?? 0) + (row.stock_other_new ?? 0);
  const delta = newTotal - oldTotal;
  if (!Number.isFinite(delta) || delta <= 0) return null;
  return {
    id: row.id,
    sourceId: row.variant_supplier_source_id,
    supplierId: row.supplier_id,
    variantId: row.variant_id,
    receivedQuantity: Math.trunc(delta),
    receivedAt: row.captured_at,
  };
}

export function extractPromises(rows: readonly SourceRow[]): PromisedReplenishment[] {
  const out: PromisedReplenishment[] = [];
  for (const r of rows) out.push(...extractPromisesFromSource(r));
  return out;
}

export function extractArrivals(rows: readonly SnapshotRow[]): ActualArrival[] {
  const out: ActualArrival[] = [];
  for (const r of rows) {
    const a = extractArrivalFromSnapshot(r);
    if (a) out.push(a);
  }
  return out;
}
