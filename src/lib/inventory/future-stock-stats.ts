/**
 * SSOT — agregação de "Estoque Futuro".
 *
 * Extraído de FutureStockDialog para permitir:
 *   1. Testes/fuzz isolados (sem render).
 *   2. Reuso entre dialog, KPI cards e futuras telas.
 *
 * INVARIANTES (validadas pelo fuzz em __tests__/future-stock-stats.fuzz.test.ts):
 *   I1  totalEntries === dedupById(entries).length
 *       → nunca conta o mesmo `id` 2x, mesmo se upstream juntar SKU×fornecedor
 *         e emitir linhas duplicadas.
 *   I2  confirmedUnits + inTransitUnits + pendingUnits + partialUnits
 *           + completedUnits + cancelledUnits + (unknown-status units) === totalUnits
 *       → entradas com status desconhecido somam em totalUnits mas não em
 *         nenhum bucket nomeado; os buckets nomeados fecham com totalUnits
 *         apenas quando todos os status são conhecidos.
 *   I3  uniqueProducts <= totalEntries
 *   I4  overdueCount <= totalEntries
 *   I5  totalUnits >= 0 (qualquer `expectedQuantity` negativo é tratado como 0).
 *   I6  nextDate é a menor `expectedDate` do conjunto (ou null se vazio).
 */
import type { FutureStockEntry } from '@/types/stock';

export interface FutureStockStats {
  totalEntries: number;
  totalUnits: number;
  confirmedUnits: number;
  inTransitUnits: number;
  pendingUnits: number;
  partialUnits: number;
  completedUnits: number;
  cancelledUnits: number;
  uniqueProducts: number;
  overdueCount: number;
  nextDate: string | null;
}

function safeQty(n: unknown): number {
  // Defensivo: negativos, NaN, Infinity viram 0 — não infla totais.
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  const now = Date.now();
  return Math.floor((t - now) / 86_400_000);
}

/** Remove duplicatas por `id` (primeira ocorrência vence). */
export function dedupeFutureEntries(entries: FutureStockEntry[]): FutureStockEntry[] {
  const seen = new Set<string>();
  const out: FutureStockEntry[] = [];
  for (const e of entries) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

export function computeFutureStockStats(entries: FutureStockEntry[]): FutureStockStats {
  const unique = dedupeFutureEntries(entries);

  let totalUnits = 0;
  let confirmedUnits = 0;
  let inTransitUnits = 0;
  let pendingUnits = 0;
  let partialUnits = 0;
  let completedUnits = 0;
  let cancelledUnits = 0;
  let overdueCount = 0;
  let nextDate: string | null = null;
  const productIds = new Set<string>();

  for (const e of unique) {
    const qty = safeQty(e.expectedQuantity);
    totalUnits += qty;

    switch (e.status) {
      case 'confirmed':
        confirmedUnits += qty;
        break;
      case 'in_transit':
        inTransitUnits += qty;
        break;
      case 'pending':
        pendingUnits += qty;
        break;
      case 'partial':
        partialUnits += qty;
        break;
      case 'completed':
        completedUnits += qty;
        break;
      case 'cancelled':
        cancelledUnits += qty;
        break;
      default:
        // status desconhecido — não soma em bucket, mas conta no total
        break;
    }

    if (e.productId) productIds.add(e.productId);
    if (daysUntil(e.expectedDate) < 0) overdueCount++;
    if (nextDate === null || e.expectedDate < nextDate) nextDate = e.expectedDate;
  }

  return {
    totalEntries: unique.length,
    totalUnits,
    confirmedUnits,
    inTransitUnits,
    pendingUnits,
    partialUnits,
    completedUnits,
    cancelledUnits,
    uniqueProducts: productIds.size,
    overdueCount,
    nextDate,
  };
}
