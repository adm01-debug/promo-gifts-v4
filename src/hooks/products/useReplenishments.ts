import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedRpc } from '@/lib/supabase-untyped';

/** Window in days for considering a product as "replenished" */
const REPLENISHMENT_WINDOW_DAYS = 30;

/** Minimum time (ms) between created_at and updated_at to qualify as replenishment (24h) */
const MIN_REPLENISHMENT_DELTA_MS = 86_400_000;

const REPLENISHMENT_SELECT =
  'id, name, sku, primary_image_url, set_image_url, images, sale_price, category_id, supplier_id, created_at, updated_at, stock_quantity' as const;


// ─── Date Utilities ──────────────────────────────────────────────

function getCutoffDate(days: number = REPLENISHMENT_WINDOW_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function calcDaysSinceReplenishment(updatedAt: string): number {
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return REPLENISHMENT_WINDOW_DAYS;
  return Math.max(0, Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24)));
}

function calcDaysRemaining(updatedAt: string): number {
  const elapsed = calcDaysSinceReplenishment(updatedAt);
  return Math.max(0, REPLENISHMENT_WINDOW_DAYS - elapsed);
}

// ─── Types ───────────────────────────────────────────────────────

export type ReplenishmentStatus = 'active' | 'expiring_soon' | 'expired';
export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface ReplenishmentWithDetails {
  readonly replenishment_id: string;
  readonly product_id: string;
  readonly product_sku: string | null;
  readonly product_name: string;
  readonly product_description: string | null;
  readonly base_price: number | null;
  readonly product_image: string | null;
  readonly product_set_image: string | null;
  readonly category_id: string | null;
  category_name: string | null;
  supplier_code: string | null;
  readonly supplier_id: string | null;
  supplier_name: string | null;
  readonly supplier_product_code: string | null;
  readonly replenished_at: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly days_remaining: number;
  readonly days_since: number;
  readonly status: ReplenishmentStatus;
  readonly is_highlighted: boolean;
  readonly is_active: boolean;
  readonly stock_quantity: number;
  readonly min_quantity: number;
  readonly stock_status: StockStatus;
}

/**
 * KPI stats para o módulo Reposição.
 *
 * PRIMÁRIOS (Cenário A — produto saiu do zero):
 *   restockedToday/Week/15d = produtos onde stock foi de 0 → positivo
 *   topSupplierName/Count   = fornecedor líder em restocks reais
 *   activeReplenishments    = variantes esgotadas com data de chegada futura
 *
 * SECUNDÁRIOS (Cenário B — reabastecimento preventivo, opcionais):
 *   reorderedThisWeek/Month  = produtos que já tinham estoque e receberam mais
 *   upcomingRestockVariants  = variantes com next_date_1 futuro (em estoque ou não)
 */
export interface ReplenishmentStatsDisplay {
  // Primários — usados pelos 5 KPI cards
  readonly totalReplenishments: number;
  readonly activeReplenishments: number;
  readonly expiringSoon: number;
  readonly totalProducts: number;
  readonly replenishmentRate: number;
  readonly restockedToday: number;
  readonly restockedThisWeek: number;
  readonly restockedLast15Days: number;
  readonly topSupplierName: string | null;
  readonly topSupplierCount: number;
  // Secundários — Cenário B (disponíveis para expansão futura da UI)
  readonly reorderedThisWeek: number;
  readonly reorderedThisMonth: number;
  readonly upcomingRestockVariants: number;
}

interface RawProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly primary_image_url: string | null;
  readonly set_image_url?: string | null;
  readonly images: string[] | null;
  readonly sale_price: number | null;
  readonly category_id: string | null;
  readonly supplier_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly stock_quantity: number | null;
  readonly min_quantity?: number | null;
}


// ─── Data Logic ──────────────────────────────────────────────────

function getStockStatus(stock: number, minQty: number): StockStatus {
  if (stock === 0) return 'out-of-stock';
  if (stock < minQty) return 'low-stock';
  return 'in-stock';
}

function getReplenishmentStatus(daysRemaining: number): ReplenishmentStatus {
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= 7) return 'expiring_soon';
  return 'active';
}

function isReplenishment(p: RawProduct): boolean {
  if (!p.updated_at || !p.created_at) return false;
  const created = new Date(p.created_at).getTime();
  const updated = new Date(p.updated_at).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created >= MIN_REPLENISHMENT_DELTA_MS;
}

function toReplenishment(p: RawProduct): ReplenishmentWithDetails {
  const daysRemaining = calcDaysRemaining(p.updated_at);
  const daysSince = calcDaysSinceReplenishment(p.updated_at);
  const expiresAt = new Date(
    new Date(p.updated_at).getTime() + REPLENISHMENT_WINDOW_DAYS * 86_400_000,
  ).toISOString();
  const stock = p.stock_quantity ?? 0;
  const minQty = 10; // Fallback since min_quantity is not in v_products_public

  return {
    replenishment_id: p.id,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    product_description: null,
    base_price: p.sale_price,
    product_image: p.primary_image_url || (p.images && p.images.length > 0 ? p.images[0] : null),
    product_set_image: p.set_image_url ?? null,
    category_id: p.category_id,
    category_name: null,
    supplier_code: null,
    supplier_id: p.supplier_id,
    supplier_name: null,
    supplier_product_code: null,
    replenished_at: p.updated_at,
    created_at: p.created_at,
    expires_at: expiresAt,
    days_remaining: daysRemaining,
    days_since: daysSince,
    status: getReplenishmentStatus(daysRemaining),
    is_highlighted: daysSince <= 5,
    is_active: daysRemaining > 0,
    stock_quantity: stock,
    min_quantity: minQty,
    stock_status: getStockStatus(stock, minQty),
  };
}

// ─── Enrichment ──────────────────────────────────────────────────

async function enrichReplenishments(
  items: ReplenishmentWithDetails[],
): Promise<ReplenishmentWithDetails[]> {
  const categoryIds = [
    ...new Set(items.map((n) => n.category_id).filter((id): id is string => id !== null)),
  ];
  const supplierIds = [
    ...new Set(items.map((n) => n.supplier_id).filter((id): id is string => id !== null)),
  ];

  const [catResult, supResult] = await Promise.all([
    categoryIds.length > 0
      ? supabase.from('categories').select('id, name').in('id', categoryIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length > 0
      ? supabase
          .from('v_suppliers_public')
          .select('id, name, code, low_stock_threshold')
          .in('id', supplierIds)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const catMap = new Map((catResult.data || []).map((c) => [c.id, c.name]));
  const supMap = new Map(
    (supResult.data || []).map((s) => [
      s.id,
      { name: s.name, code: s.code ?? null, low_stock_threshold: (s as any).low_stock_threshold ?? 10 },
    ]),
  );

  return items.map((n) => {
    const sup = n.supplier_id ? supMap.get(n.supplier_id) : undefined;
    const threshold = sup?.low_stock_threshold ?? 10;
    return {
      ...n,
      category_name: (n.category_id ? catMap.get(n.category_id) : undefined) ?? null,
      supplier_name: sup?.name ?? null,
      supplier_code: sup?.code ?? null,
      // Recalculate with per-supplier low_stock_threshold (Asia=50, others=10)
      min_quantity: threshold,
      stock_status: getStockStatus(n.stock_quantity, threshold),
    };
  });
}

// ─── Hooks ───────────────────────────────────────────────────────

export interface UseReplenishmentsOptions {
  readonly limit?: number;
  readonly onlyHighlighted?: boolean;
}

export function useReplenishmentsWithDetails(options: UseReplenishmentsOptions = {}) {
  const { limit = 200, onlyHighlighted = false } = options;

  return useQuery<ReplenishmentWithDetails[], Error>({
    queryKey: ['replenishments-details', limit, onlyHighlighted],
    queryFn: async () => {
      const cutoff = getCutoffDate();

      // Note: 'isReplenishment' uses updated_at heuristic as proxy for real restock events.
      // Products with stock_quantity > 0 are filtered here to eliminate price/data updates
      // from appearing as replenishments. For true zero→positive restock detection, use
      // fn_get_replenishment_stats() which reads stock_daily_summary.restock_zero_to_positive.
      const { data, error } = await supabase
        .from('v_products_public')
        .select(REPLENISHMENT_SELECT)
        .is('is_active', true)
        .gt('stock_quantity', 0)
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false })
        .range(0, limit - 1);

      if (error) {
        const isGone = error.message?.includes('410') || error.message?.includes('Gone');
        if (isGone) {
          const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
          reportSilentEmpty({
            reason: 'gone_410',
            table: 'v_products_public',
            operation: 'select',
            message: error.message,
          });
          return [];
        }
        throw error;
      }

      let items = ((data as unknown as RawProduct[]) || [])
        .filter(isReplenishment)
        .map(toReplenishment)
        .filter((n) => n.is_active);

      if (onlyHighlighted) {
        items = items.filter((n) => n.is_highlighted);
      }

      return enrichReplenishments(items);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

// ─── Stats Hook (RPC) ────────────────────────────────────────────
//
// FONTE DE VERDADE: fn_get_replenishment_stats() no Supabase
//
// KPI PRIMÁRIOS — Cenário A (produto saiu do zero):
//   stock_open=0 → stock_close>0 = esgotado voltou ao estoque
//   Exclui naturalmente o dia de inicialização (06/06) e Cenário C.
//
// KPI SECUNDÁRIOS — Cenário B (reabastecimento preventivo):
//   reorderedThisWeek/Month = tinha estoque, recebeu mais
//   upcomingRestockVariants = variantes com next_date_1 futuro
//
// untypedRpc: fn_get_replenishment_stats não está nos tipos gerados.
// Migrar para supabase.rpc() após rerun do types.ts.

export function useReplenishmentStats() {
  return useQuery<ReplenishmentStatsDisplay, Error>({
    queryKey: ['replenishment-stats'],
    queryFn: async () => {
      const { data: rawData, error } = await untypedRpc('fn_get_replenishment_stats');

      if (error) {
        if (error.message?.includes('410') || error.message?.includes('Gone')) {
          return {
            totalReplenishments:    0,
            activeReplenishments:   0,
            expiringSoon:           0,
            totalProducts:          0,
            replenishmentRate:      0,
            restockedToday:         0,
            restockedThisWeek:      0,
            restockedLast15Days:    0,
            topSupplierName:        null,
            topSupplierCount:       0,
            reorderedThisWeek:      0,
            reorderedThisMonth:     0,
            upcomingRestockVariants: 0,
          };
        }
        throw error;
      }

      const d = (rawData ?? {}) as Record<string, unknown>;

      return {
        // ─ Primários (KPI cards) ─
        totalReplenishments:     Number(d.restockedThisWeek    ?? 0),
        activeReplenishments:    Number(d.activeReplenishments ?? 0),
        expiringSoon:            0,
        totalProducts:           Number(d.totalVariants        ?? 0),
        replenishmentRate:       Number(d.replenishmentRate    ?? 0),
        restockedToday:          Number(d.restockedToday       ?? 0),
        restockedThisWeek:       Number(d.restockedThisWeek    ?? 0),
        restockedLast15Days:     Number(d.restockedLast15Days  ?? 0),
        topSupplierName:         (d.topSupplierName as string) ?? null,
        topSupplierCount:        Number(d.topSupplierCount     ?? 0),
        // ─ Secundários (Cenário B — expansão futura da UI) ─
        reorderedThisWeek:       Number(d.reorderedThisWeek      ?? 0),
        reorderedThisMonth:      Number(d.reorderedThisMonth     ?? 0),
        upcomingRestockVariants: Number(d.upcomingRestockVariants ?? 0),
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useReplenishmentCount() {
  return useQuery<number, Error>({
    queryKey: ['replenishment-count'],
    queryFn: async () => {
      const cutoff = getCutoffDate();

      const { data, error } = await supabase
        .from('v_products_public')
        .select('id, created_at, updated_at')
        .is('is_active', true)
        .gt('stock_quantity', 0)
        .gte('updated_at', cutoff)
        .limit(500);

      if (error) {
        if (error.message?.includes('410')) return 0;
        throw error;
      }

      return ((data as unknown as RawProduct[]) || []).filter(isReplenishment).length;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}
