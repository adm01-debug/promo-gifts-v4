import { useQuery } from '@tanstack/react-query';
import { untypedRpc } from '@/lib/supabase-untyped';
import { shouldRetry } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';

/**
 * Módulo Reposição — FONTE ÚNICA DE VERDADE: RPC `fn_get_reposicao_listing`.
 *
 * Antes este hook inferia "reposição" por produtos recém-editados em
 * v_products_public (delta created_at↔updated_at ≥ 24h). Isso NÃO refletia
 * reabastecimento real e divergia dos KPIs. Agora a grade, o widget e a
 * contagem consomem o mesmo RPC canônico que alimenta os cards:
 * detecção zero→positivo (fronteira do dia), no fuso America/Sao_Paulo,
 * com atribuição determinística de fornecedor.
 */
const REPLENISHMENT_WINDOW_DAYS = 30;

/** Carrega o conjunto COMPLETO de reposições da janela (evita truncamento). */
const FETCH_ALL_LIMIT = 2000;

// ─── Types ───────────────────────────────────────────────────────

export type ReplenishmentStatus = 'active' | 'expired' | 'expiring_soon';
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
  readonly totalReplenishments: number;
  readonly activeReplenishments: number;
  readonly expiringSoon: number;
  readonly totalProducts: number;
  readonly replenishmentRate: number;
  readonly restockedToday: number;
  readonly restockedThisWeek: number;
  readonly restockedLast15Days: number;
  readonly restockedLast30Days: number;
  readonly topSupplierName: string | null;
  readonly topSupplierCount: number;
  readonly reorderedThisWeek: number;
  readonly reorderedThisMonth: number;
  readonly upcomingRestockVariants: number;
}

/** Linha crua retornada pelo RPC fn_get_reposicao_listing. */
interface ReposicaoRow {
  readonly product_id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly sku: string | null;
  readonly sale_price: number | null;
  readonly is_stockout: boolean | null;
  readonly is_new: boolean | null;
  readonly total_stock: number | null;
  readonly primary_image_url: string | null;
  readonly primary_image_cdn: string | null;
  readonly supplier_id: string | null;
  readonly supplier_name: string | null;
  readonly supplier_code: string | null;
  readonly ultimo_restock_date: string | null;
  readonly earliest_restock_date: string | null;
  readonly earliest_restock_qty: number | null;
  readonly has_upcoming_restock: boolean | null;
  readonly category_names: string[] | null;
  readonly primary_category_id: string | null;
  readonly primary_category_name: string | null;
  readonly is_low_stock: boolean | null;
}

// ─── Date Utilities ──────────────────────────────────────────────
//
// O RPC entrega `ultimo_restock_date` como 'YYYY-MM-DD' (data BR).
// Ancoramos no MEIO-DIA LOCAL para que a diferença em dias de calendário
// não sofra off-by-one por fuso (parse de 'YYYY-MM-DD' vira 00:00 UTC).

function daysSinceLocal(dateStr: string | null): number {
  if (!dateStr) return REPLENISHMENT_WINDOW_DAYS;
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return REPLENISHMENT_WINDOW_DAYS;
  }
  const [y, m, d] = parts;
  const restockNoon = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  const now = new Date();
  const todayNoon = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  ).getTime();
  return Math.max(0, Math.round((todayNoon - restockNoon) / 86_400_000));
}

function addDaysISO(dateStr: string | null, days: number): string {
  const base = dateStr ? new Date(`${dateStr.slice(0, 10)}T12:00:00`) : new Date();
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

// ─── Data Logic ──────────────────────────────────────────────────

function deriveStockStatus(
  totalStock: number,
  isStockout: boolean,
  isLowStock: boolean,
): StockStatus {
  if (isStockout || totalStock <= 0) return 'out-of-stock';
  if (isLowStock) return 'low-stock';
  return 'in-stock';
}

function statusFromDaysRemaining(daysRemaining: number): ReplenishmentStatus {
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= 7) return 'expiring_soon';
  return 'active';
}

function mapRow(r: ReposicaoRow): ReplenishmentWithDetails {
  const restockDate = r.ultimo_restock_date;
  const nowIso = new Date().toISOString();
  const daysSince = daysSinceLocal(restockDate);
  const daysRemaining = Math.max(0, REPLENISHMENT_WINDOW_DAYS - daysSince);
  const totalStock = Number(r.total_stock ?? 0);
  const isStockout = Boolean(r.is_stockout) || totalStock <= 0;

  return {
    replenishment_id: r.product_id,
    product_id: r.product_id,
    product_sku: r.sku,
    product_name: r.name,
    product_description: null,
    base_price: r.sale_price,
    product_image: r.primary_image_cdn ?? r.primary_image_url,
    product_set_image: null,
    category_id: r.primary_category_id,
    category_name: r.primary_category_name,
    supplier_code: r.supplier_code,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    supplier_product_code: null,
    replenished_at: restockDate ?? nowIso,
    created_at: restockDate ?? nowIso,
    expires_at: addDaysISO(restockDate, REPLENISHMENT_WINDOW_DAYS),
    days_remaining: daysRemaining,
    days_since: daysSince,
    status: statusFromDaysRemaining(daysRemaining),
    is_highlighted: daysSince <= 5,
    is_active: true,
    stock_quantity: totalStock,
    min_quantity: 0,
    stock_status: deriveStockStatus(totalStock, isStockout, Boolean(r.is_low_stock)),
  };
}

function isGoneError(error: { message?: string } | null): boolean {
  const msg = error?.message;
  return Boolean(msg && (msg.includes('410') || msg.includes('Gone')));
}

async function fetchReposicao(limit: number): Promise<ReplenishmentWithDetails[]> {
  const { data, error } = await untypedRpc('fn_get_reposicao_listing', {
    p_supplier_id: null,
    p_category_id: null,
    p_sort_by: 'mais_recentes',
    p_limit: limit,
    p_offset: 0,
    p_days: REPLENISHMENT_WINDOW_DAYS,
  });

  if (error) {
    if (isGoneError(error)) {
      logger.warn(
        '[Reposição] fn_get_reposicao_listing retornou 410 Gone — possível schema desatualizado. Retornando lista vazia.',
        error.message,
      );
      return [];
    }
    throw error;
  }

  const rows = (data as unknown as ReposicaoRow[]) ?? [];
  return rows.map(mapRow);
}

// ─── Hooks ───────────────────────────────────────────────────────

export interface UseReplenishmentsOptions {
  readonly limit?: number;
  readonly onlyHighlighted?: boolean;
}

export function useReplenishmentsWithDetails(options: UseReplenishmentsOptions = {}) {
  const { limit = FETCH_ALL_LIMIT, onlyHighlighted = false } = options;

  return useQuery<ReplenishmentWithDetails[], Error, ReplenishmentWithDetails[]>({
    queryKey: ['replenishments-details', limit],
    queryFn: async () => fetchReposicao(limit),
    // filter in select so toggling onlyHighlighted reuses cached data without re-fetch
    select: (items) => (onlyHighlighted ? items.filter((n) => n.is_highlighted) : items),
    staleTime: 2 * 60 * 1000,
    retry: shouldRetry,
  });
}

// ─── Stats Hook (RPC) ────────────────────────────────────────────
//
// FONTE DE VERDADE: fn_get_replenishment_stats() no Supabase.
// untypedRpc: função não está nos tipos gerados; migrar para supabase.rpc()
// após rerun do types.ts.

export function useReplenishmentStats() {
  return useQuery<ReplenishmentStatsDisplay>({
    queryKey: ['replenishment-stats'],
    queryFn: async () => {
      const { data: rawData, error } = await untypedRpc('fn_get_replenishment_stats');

      if (error) {
        if (isGoneError(error)) {
          logger.warn(
            '[Reposição] fn_get_replenishment_stats retornou 410 Gone — retornando stats zeradas.',
            error.message,
          );
          return {
            totalReplenishments: 0,
            activeReplenishments: 0,
            expiringSoon: 0,
            totalProducts: 0,
            replenishmentRate: 0,
            restockedToday: 0,
            restockedThisWeek: 0,
            restockedLast15Days: 0,
            restockedLast30Days: 0,
            topSupplierName: null,
            topSupplierCount: 0,
            reorderedThisWeek: 0,
            reorderedThisMonth: 0,
            upcomingRestockVariants: 0,
          };
        }
        throw error;
      }

      const d = (rawData ?? {}) as Record<string, unknown>;

      return {
        totalReplenishments: Number(d.restockedLast30Days ?? 0),
        activeReplenishments: Number(d.activeReplenishments ?? 0),
        expiringSoon: Number(d.expiringSoon ?? 0),
        totalProducts: Number(d.totalVariants ?? 0),
        replenishmentRate: Number(d.replenishmentRate ?? 0),
        restockedToday: Number(d.restockedToday ?? 0),
        restockedThisWeek: Number(d.restockedThisWeek ?? 0),
        restockedLast15Days: Number(d.restockedLast15Days ?? 0),
        restockedLast30Days: Number(d.restockedLast30Days ?? 0),
        topSupplierName: (d.topSupplierName as string) ?? null,
        topSupplierCount: Number(d.topSupplierCount ?? 0),
        reorderedThisWeek: Number(d.reorderedThisWeek ?? 0),
        reorderedThisMonth: Number(d.reorderedThisMonth ?? 0),
        upcomingRestockVariants: Number(d.upcomingRestockVariants ?? 0),
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
  });
}

export function useReplenishmentCount() {
  // Must match useReplenishmentsWithDetails(default) queryKey — no duplicate fetch.
  return useQuery<ReplenishmentWithDetails[], Error, number>({
    queryKey: ['replenishments-details', FETCH_ALL_LIMIT],
    queryFn: () => fetchReposicao(FETCH_ALL_LIMIT),
    select: (data) => data.length,
    staleTime: 2 * 60 * 1000,
    retry: shouldRetry,
  });
}
