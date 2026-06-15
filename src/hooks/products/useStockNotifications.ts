import { useQuery } from '@tanstack/react-query';
import { untypedRpc } from '@/lib/supabase-untyped';
import { shouldRetry } from '@/lib/db/postgrest';

/**
 * Hooks DEDICADOS do módulo "Notificações de Estoque" (sino do header,
 * `StockAlertsIndicator`). Cada categoria é alimentada por uma RPC server-side
 * alinhada à fonte de verdade — sem alterar os hooks compartilhados
 * (`useNovelties`, `useReplenishments`, `useStockAlerts`).
 *
 * Fontes de verdade (ver docs/notifications-module-audit.md):
 *   Zerou    -> products.is_stockout = true            (fn_get_stockout_alerts)
 *   Baixo    -> stock <= suppliers.low_stock_threshold (fn_get_low_stock_alerts) [badge #8]
 *   Novidade -> product_novelties ativas + qualidade   (fn_get_novelty_alerts)
 *   Chegou   -> stock_daily_summary 0->positivo, disponível (fn_get_recent_restocks)
 *   Contadores das 4 categorias em 1 round-trip          (fn_get_stock_notification_counts)
 *
 * As RPCs não estão nos tipos gerados do Supabase, então usamos `untypedRpc`
 * (escape hatch) e tipamos a resposta no call site via `RpcResult<T>` para não
 * deixar `any` vazar (mantém o lint type-aware satisfeito).
 */

const STALE = 2 * 60 * 1000;

export type StockNotificationKind = 'stockout' | 'low' | 'new' | 'restocked';

export interface StockNotificationCounts {
  stockout: number;
  low_stock: number;
  novelties: number;
  restocks: number;
  total: number;
}

export interface StockNotificationItem {
  /** id sintético único por categoria+produto (evita colisão de keys entre abas) */
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
  lastRestockDate?: string | null;
}

/** Shape da resposta do PostgREST/Supabase, tipada no call site. */
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
interface RestockRow extends BaseRow {
  last_restock_date: string | null;
}
interface LowStockRow extends BaseRow {
  low_stock_threshold: number | null;
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

const baseItem = (
  r: BaseRow,
  kind: StockNotificationKind,
  idPrefix: string,
): StockNotificationItem => ({
  id: `${idPrefix}-${r.product_id}`,
  productId: r.product_id,
  productName: r.product_name ?? '',
  sku: r.product_sku ?? '',
  imageUrl: r.image_url,
  supplier: r.supplier_name ?? '',
  kind,
  stockQuantity: r.stock_quantity,
});

export function useStockNotificationCounts() {
  return useQuery<StockNotificationCounts, Error>({
    queryKey: ['stock-notif-counts'],
    queryFn: async () => {
      const { data, error } = (await untypedRpc(
        'fn_get_stock_notification_counts',
      )) as RpcResult<CountsRow>;
      if (error) throw new Error(error.message);
      const d = data ?? { stockout: 0, low_stock: 0, novelties: 0, restocks: 0 };
      return {
        stockout: d.stockout,
        low_stock: d.low_stock,
        novelties: d.novelties,
        restocks: d.restocks,
        total: d.stockout + d.low_stock + d.novelties + d.restocks,
      };
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useStockoutAlerts(limit = 50) {
  return useQuery<StockNotificationItem[], Error>({
    queryKey: ['stock-notif-stockout', limit],
    queryFn: async () => {
      const { data, error } = (await untypedRpc('fn_get_stockout_alerts', {
        p_limit: limit,
      })) as RpcResult<BaseRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => baseItem(r, 'stockout', 'stockout'));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useLowStockAlerts(limit = 50) {
  return useQuery<StockNotificationItem[], Error>({
    queryKey: ['stock-notif-low', limit],
    queryFn: async () => {
      const { data, error } = (await untypedRpc('fn_get_low_stock_alerts', {
        p_limit: limit,
      })) as RpcResult<LowStockRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        ...baseItem(r, 'low', 'low'),
        lowStockThreshold: r.low_stock_threshold,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useNoveltyAlerts(limit = 30) {
  return useQuery<StockNotificationItem[], Error>({
    queryKey: ['stock-notif-novelty', limit],
    queryFn: async () => {
      const { data, error } = (await untypedRpc('fn_get_novelty_alerts', {
        p_limit: limit,
      })) as RpcResult<NoveltyRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        ...baseItem(r, 'new', 'new'),
        daysRemaining: r.days_remaining,
        isHighlighted: r.is_highlighted ?? false,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useRecentRestocks(limit = 30) {
  return useQuery<StockNotificationItem[], Error>({
    queryKey: ['stock-notif-restocks', limit],
    queryFn: async () => {
      const { data, error } = (await untypedRpc('fn_get_recent_restocks', {
        p_limit: limit,
      })) as RpcResult<RestockRow[]>;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        ...baseItem(r, 'restocked', 'restocked'),
        lastRestockDate: r.last_restock_date,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}
