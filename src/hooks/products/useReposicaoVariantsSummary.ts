/**
 * useReposicaoVariantsSummary — Onda 1 da Reposição
 *
 * Consulta a RPC `fn_get_reposicao_variants_summary(p_product_ids)` (Gold) e
 * devolve, por produto, um Map indexado por NOME DE COR normalizado
 * (lowercase, trim, sem acentos) com os campos consumidos pelos swatches:
 *   - stock_qty            (int)
 *   - has_upcoming_restock (bool)
 *   - next_restock_date    (date|null)
 *   - variant_id           (uuid)
 *
 * A indexação por nome (não por variant_id) é proposital: os swatches
 * existentes vêm de `useProductsColorsBatch` (que agrega por cor única
 * `nome|hex`) e o ponto de fusão é a string da cor. Hooks futuros podem
 * indexar por variant_id quando a UI passar a navegar variante-a-variante.
 *
 * Strict boundary "> hoje (TZ Brasil)" — a RPC já aplica essa regra.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { untypedRpc } from '@/lib/supabase-untyped';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('reposicao.variants-summary');

export interface VariantSummaryEntry {
  readonly variantId: string;
  readonly stockQty: number;
  readonly hasUpcomingRestock: boolean;
  readonly nextRestockDate: string | null;
}

/** Map<productId, Map<colorNameKey, VariantSummaryEntry>> */
export type VariantsSummaryByProduct = ReadonlyMap<
  string,
  ReadonlyMap<string, VariantSummaryEntry>
>;

/** Normaliza nome de cor para casamento estável (lowercase + trim + sem diacríticos). */
export function normalizeColorKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface RpcRow {
  product_id: string;
  variants_summary: Array<{
    variant_id: string;
    nome: string | null;
    hex: string | null;
    stock_qty: number;
    has_upcoming_restock: boolean;
    next_restock_date: string | null;
  }> | null;
  total_variants: number;
  variants_in_stock: number;
  variants_zeroed: number;
  variants_with_upcoming: number;
}

const EMPTY: VariantsSummaryByProduct = new Map();

function isRpcRow(obj: unknown): obj is RpcRow {
  if (typeof obj !== 'object' || obj === null) return false;
  const row = obj as Record<string, unknown>;
  if (typeof row.product_id !== 'string') return false;
  if (!(row.variants_summary === null || Array.isArray(row.variants_summary))) return false;
  return true;
}

/**
 * Busca o sumário de variantes para um conjunto de productIds.
 * Retorna Map vazio quando productIds for vazio (não dispara a RPC).
 */
export function useReposicaoVariantsSummary(productIds: readonly string[]) {
  // Memoizado: evita recriar array/string em cada render mesmo que os IDs não mudem.
  const sortedIds = useMemo(() => [...productIds].sort(), [productIds]);
  const key = useMemo(() => sortedIds.join(','), [sortedIds]);

  return useQuery<VariantsSummaryByProduct>({
    queryKey: ['reposicao-variants-summary', key],
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const { data, error } = await untypedRpc('fn_get_reposicao_variants_summary', {
          p_product_ids: sortedIds,
        });
        if (error) {
          log.warn('rpc_failed', { error: error.message, ids: sortedIds.length });
          return EMPTY;
        }
        const rows = ((data ?? []) as unknown[]).filter(isRpcRow);
        const out = new Map<string, Map<string, VariantSummaryEntry>>();
        for (const row of rows) {
          const inner = new Map<string, VariantSummaryEntry>();
          for (const v of row.variants_summary ?? []) {
            const k = normalizeColorKey(v.nome);
            if (!k) {
              log.warn('variant_sem_nome_de_cor', { variant_id: v.variant_id, product_id: row.product_id });
              continue;
            }
            inner.set(k, {
              variantId: v.variant_id,
              stockQty: v.stock_qty,
              hasUpcomingRestock: Boolean(v.has_upcoming_restock),
              nextRestockDate: v.next_restock_date,
            });
          }
          if (inner.size > 0) out.set(row.product_id, inner);
        }
        return out;
      } catch (err) {
        log.error('unexpected_failure', {
          error: err instanceof Error ? err.message : String(err),
        });
        return EMPTY;
      }
    },
  });
}
