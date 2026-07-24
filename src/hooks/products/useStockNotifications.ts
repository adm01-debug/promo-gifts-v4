import { useQuery } from '@tanstack/react-query';
import { untypedRpc } from '@/lib/supabase-untyped';
import { shouldRetry } from '@/lib/db/postgrest';

/**
 * Hooks DEDICADOS do módulo "Notificações de Estoque".
 *
 * v2 — filtro de período (p_since) + eventDate por item
 *   - Zerou    → last_stock_update_at  (fn_get_stockout_alerts)
 *   - Baixo    → last_stock_update_at  (fn_get_low_stock_alerts) [badge #8]
 *   - Novidade → detected_at           (fn_get_novelty_alerts)
 *   - Chegou   → last_restock_date     (fn_get_recent_restocks)  [Cenário A]
 *   - Contadores filtrados por período  (fn_get_stock_notification_counts)
 *
 * Parâmetro `since?: string | null`: ISO date 'YYYY-MM-DD' ou null (sem filtro).
 * Inclui em queryKey para que React Query re-busque ao mudar período.
 */

const STALE = 2 * 60 * 1000;

export type StockNotificationKind = 'low' | 'new' | 'restocked' | 'stockout';

export interface StockNotificationCounts {
  stockout: number;
  low_stock: number;
  novelties: number;
  restocks: number;
  total: number;
}

export interface StockNotificationItem {
  /** id sintético único por categoria+produto */
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  supplier: string;
  kind: StockNotificationKind;
  stockQuantity: number | null;
  lowStockThreshold?: number | null;
  daysRemaining?: number | null;
  isHighlighted?: boolean;
  /**
   * Data em que o evento ocorreu, usada para exibição e filtro de período.
   *   stockout  → last_stock_update_at (timestamptz)
   *   low       → last_stock_update_at (timestamptz)
   *   new       → detected_at          (timestamptz)
   *   restocked → last_restock_date    (date)
   */
  eventDate: string | null;
}

// ─── Tipos internos (shapes das RPCs) ────────────────────────────

/** Forma mínima tipada do retorno PostgREST/Supabase. */
interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface BaseRow {
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  image_url: string | null;
  stock_quantity: number | null;
  supplier_id: string | null;
  supplier_name: string | null;
}
interface StockoutRow extends BaseRow {
  last_stock_update_at: string | null;
}
interface RestockRow extends BaseRow {
  last_restock_date: string | null;
}
interface LowStockRow extends BaseRow {
  low_stock_threshold: number | null;
  last_stock_update_at: string | null;
}
interface NoveltyRow extends BaseRow {
  detected_at: string | null;
  days_remaining: number | null;
  is_highlighted: boolean | null;
}
interface CountsRow {
  stockout: number;
  low_stock: number;
  novelties: number;
  restocks: number;
}

// ─── Helpers internos ─────────────────────────────────────────────

const baseItem = (
  r: BaseRow,
  kind: StockNotificationKind,
  idPrefix: string,
  eventDate: string | null = null,
): StockNotificationItem => ({
  id: `${idPrefix}-${r.product_id}`,
  productId: r.product_id,
  productName: r.product_name ?? '',
  sku: r.product_sku ?? '',
  imageUrl: r.image_url,
  supplier: r.supplier_name ?? '',
  kind,
  stockQuantity: r.stock_quantity,
  eventDate,
});

/** Monta o objeto de args para a RPC, adicionando p_since apenas quando fornecido. */
function buildArgs(limit: number, since?: string | null): Record<string, unknown> {
  const args: Record<string, unknown> = { p_limit: limit };
  if (since) args.p_since = since;
  return args;
}

// ─── Contadores (server-side, exatos, filtrados por período) ──────

export function useStockNotificationCounts(since?: string | null) {
  return useQuery<StockNotificationCounts>({
    queryKey: ['stock-notif-counts', since ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {};
      if (since) args.p_since = since;
      const { data, error } = (await untypedRpc(
        'fn_get_stock_notification_counts',
        args,
      )) as RpcResult<CountsRow>;
      if (error) throw new Error(error.message);
      // PostgREST SETOF functions wrap results in an array; unwrap before accessing fields.
      const raw = Array.isArray(data) ? (data as CountsRow[])[0] : (data as CountsRow | null);
      const d = raw ?? { stockout: 0, low_stock: 0, novelties: 0, restocks: 0 };
      return {
        stockout: d.stockout ?? 0,
        low_stock: d.low_stock ?? 0,
        novelties: d.novelties ?? 0,
        restocks: d.restocks ?? 0,
        total: (d.stockout ?? 0) + (d.low_stock ?? 0) + (d.novelties ?? 0) + (d.restocks ?? 0),
      };
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

// ─── Listas por categoria, filtradas por período ──────────────────

export function useStockoutAlerts(limit = 50, since?: string | null) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-stockout', limit, since ?? 'all'],
    queryFn: async () => {
      const { data, error } = (await untypedRpc(
        'fn_get_stockout_alerts',
        buildArgs(limit, since),
      )) as RpcResult<StockoutRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => baseItem(r, 'stockout', 'stockout', r.last_stock_update_at));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useLowStockAlerts(limit = 50, since?: string | null) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-low', limit, since ?? 'all'],
    queryFn: async () => {
      const { data, error } = (await untypedRpc(
        'fn_get_low_stock_alerts',
        buildArgs(limit, since),
      )) as RpcResult<LowStockRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        ...baseItem(r, 'low', 'low', r.last_stock_update_at),
        lowStockThreshold: r.low_stock_threshold,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useNoveltyAlerts(limit = 30, since?: string | null) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-novelty', limit, since ?? 'all'],
    queryFn: async () => {
      const { data, error } = (await untypedRpc(
        'fn_get_novelty_alerts',
        buildArgs(limit, since),
      )) as RpcResult<NoveltyRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        ...baseItem(r, 'new', 'new', r.detected_at),
        daysRemaining: r.days_remaining,
        isHighlighted: r.is_highlighted ?? false,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useRecentRestocks(limit = 30, since?: string | null) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-restocks', limit, since ?? 'all'],
    queryFn: async () => {
      const { data, error } = (await untypedRpc(
        'fn_get_recent_restocks',
        buildArgs(limit, since),
      )) as RpcResult<RestockRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => baseItem(r, 'restocked', 'restocked', r.last_restock_date));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}
