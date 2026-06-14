import { useQuery } from '@tanstack/react-query';
import { untypedRpc } from '@/lib/supabase-untyped';
import { shouldRetry } from '@/lib/db/postgrest';

/**
 * Hooks DEDICADOS do módulo "Notificações de Estoque" (sino do header,
 * `StockAlertsIndicator`). Cada categoria é alimentada por uma RPC server-side
 * alinhada à fonte de verdade — diferente dos hooks compartilhados
 * (`useNovelties`, `useReplenishments`, `useStockAlerts`), que continuam
 * servindo outros módulos sem alteração.
 *
 * Fontes de verdade (ver auditoria em docs/notifications-module-audit.md):
 *   - Zerou    → products.is_stockout = true            (fn_get_stockout_alerts)
 *   - Baixo    → stock <= suppliers.low_stock_threshold (fn_get_low_stock_alerts) [badge #8]
 *   - Novidade → product_novelties ativas + qualidade   (fn_get_novelty_alerts)
 *   - Chegou   → stock_daily_summary 0→positivo (Cenário A), atualmente disponível
 *               (fn_get_recent_restocks) — mesma semântica de fn_get_replenishment_stats
 *   - Contadores exatos das 4 categorias em 1 round-trip (fn_get_stock_notification_counts)
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
  /** id sintético, único por categoria+produto (evita colisão de keys entre abas) */
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

// ─── Row shapes (colunas das RPCs) ───────────────────────────────

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

// ─── Contadores (server-side, exatos) ────────────────────────────

export function useStockNotificationCounts() {
  return useQuery<StockNotificationCounts>({
    queryKey: ['stock-notif-counts'],
    queryFn: async () => {
      const { data, error } = await untypedRpc('fn_get_stock_notification_counts');
      if (error) throw error;
      const d = (data ?? {}) as Record<string, unknown>;
      const stockout = Number(d.stockout ?? 0);
      const low_stock = Number(d.low_stock ?? 0);
      const novelties = Number(d.novelties ?? 0);
      const restocks = Number(d.restocks ?? 0);
      return {
        stockout,
        low_stock,
        novelties,
        restocks,
        total: stockout + low_stock + novelties + restocks,
      };
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

// ─── Listas (limitadas; "ver todos" leva ao módulo completo) ─────

export function useStockoutAlerts(limit = 50) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-stockout', limit],
    queryFn: async () => {
      const { data, error } = await untypedRpc('fn_get_stockout_alerts', { p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as BaseRow[]).map((r) => baseItem(r, 'stockout', 'stockout'));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useLowStockAlerts(limit = 50) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-low', limit],
    queryFn: async () => {
      const { data, error } = await untypedRpc('fn_get_low_stock_alerts', { p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as LowStockRow[]).map((r) => ({
        ...baseItem(r, 'low', 'low'),
        lowStockThreshold: r.low_stock_threshold,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}

export function useNoveltyAlerts(limit = 30) {
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-novelty', limit],
    queryFn: async () => {
      const { data, error } = await untypedRpc('fn_get_novelty_alerts', { p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as NoveltyRow[]).map((r) => ({
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
  return useQuery<StockNotificationItem[]>({
    queryKey: ['stock-notif-restocks', limit],
    queryFn: async () => {
      const { data, error } = await untypedRpc('fn_get_recent_restocks', { p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as RestockRow[]).map((r) => ({
        ...baseItem(r, 'restocked', 'restocked'),
        lastRestockDate: r.last_restock_date,
      }));
    },
    staleTime: STALE,
    retry: shouldRetry,
  });
}
