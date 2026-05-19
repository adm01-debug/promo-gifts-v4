import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db/bridge';

/** Window in days for considering a product as "replenished" */
const REPLENISHMENT_WINDOW_DAYS = 30;

/** Minimum time (ms) between created_at and updated_at to qualify as replenishment (24h) */
const MIN_REPLENISHMENT_DELTA_MS = 86_400_000;

const REPLENISHMENT_SELECT = 'id, name, sku, primary_image_url, sale_price, category_id, supplier_id, created_at, updated_at, stock_quantity, min_quantity' as const;

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

export interface ReplenishmentStatsDisplay {
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
}

interface RawProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly primary_image_url: string | null;
  readonly sale_price: number | null;
  readonly category_id: string | null;
  readonly supplier_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly stock_quantity: number | null;
  readonly min_quantity: number | null;
}

interface CategoryRecord {
  readonly id: string;
  readonly name: string;
}

interface SupplierRecord {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
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
  return (updated - created) >= MIN_REPLENISHMENT_DELTA_MS;
}

function toReplenishment(p: RawProduct): ReplenishmentWithDetails {
  const daysRemaining = calcDaysRemaining(p.updated_at);
  const daysSince = calcDaysSinceReplenishment(p.updated_at);
  const expiresAt = new Date(new Date(p.updated_at).getTime() + REPLENISHMENT_WINDOW_DAYS * 86_400_000).toISOString();
  const stock = p.stock_quantity ?? 0;
  const minQty = p.min_quantity ?? 10;

  return {
    replenishment_id: p.id,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    product_description: null,
    base_price: p.sale_price,
    product_image: p.primary_image_url,
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

async function enrichReplenishments(items: ReplenishmentWithDetails[]): Promise<ReplenishmentWithDetails[]> {
  const categoryIds = [...new Set(items.map(n => n.category_id).filter((id): id is string => id !== null))];
  const supplierIds = [...new Set(items.map(n => n.supplier_id).filter((id): id is string => id !== null))];

  const [catResult, supResult] = await Promise.all([
    categoryIds.length > 0
      ? invokeExternalDb<CategoryRecord>({ table: 'categories', operation: 'select', select: 'id, name', filters: { id: `in.(${categoryIds.join(',')})` }, limit: 500 })
      : { records: [] as CategoryRecord[] },
    supplierIds.length > 0
      ? invokeExternalDb<SupplierRecord>({ table: 'suppliers', operation: 'select', select: 'id, name, code', filters: { id: `in.(${supplierIds.join(',')})` }, limit: 200 })
      : { records: [] as SupplierRecord[] },
  ]);

  const catMap = new Map(catResult.records.map(c => [c.id, c.name]));
  const supMap = new Map(supResult.records.map(s => [s.id, { name: s.name, code: s.code ?? null }]));

  return items.map(n => ({
    ...n,
    category_name: (n.category_id ? catMap.get(n.category_id) : undefined) ?? null,
    supplier_name: (n.supplier_id ? supMap.get(n.supplier_id)?.name : undefined) ?? null,
    supplier_code: (n.supplier_id ? supMap.get(n.supplier_id)?.code : undefined) ?? null,
  }));
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

      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: REPLENISHMENT_SELECT,
        filters: { is_active: true, updated_at: `gte.${cutoff}` },
        orderBy: { column: 'updated_at', ascending: false },
        limit,
      });

      let items = result.records
        .filter(isReplenishment)
        .map(toReplenishment)
        .filter(n => n.is_active);

      if (onlyHighlighted) {
        items = items.filter(n => n.is_highlighted);
      }

      return enrichReplenishments(items);
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

export function useReplenishmentStats() {
  return useQuery<ReplenishmentStatsDisplay, Error>({
    queryKey: ['replenishment-stats'],
    queryFn: async () => {
      const cutoff = getCutoffDate();

      const [repResult, totalResult] = await Promise.all([
        invokeExternalDb<RawProduct>({
          table: 'products',
          operation: 'select',
          select: 'id, created_at, updated_at, supplier_id',
          filters: { is_active: true, updated_at: `gte.${cutoff}` },
          limit: 500,
          countMode: 'exact',
        }),
        invokeExternalDb<{ id: string }>({
          table: 'products',
          operation: 'select',
          select: 'id',
          filters: { is_active: true },
          limit: 1,
          countMode: 'exact',
        }),
      ]);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - 6 * 86_400_000;
      const fifteenDaysStart = todayStart - 14 * 86_400_000;

      const replenishments = repResult.records
        .filter(isReplenishment)
        .map(p => ({
          daysRemaining: calcDaysRemaining(p.updated_at),
          updatedTime: new Date(p.updated_at).getTime(),
          supplierId: p.supplier_id,
        }));

      const active = replenishments.filter(n => n.daysRemaining > 0);
      const expiring = active.filter(n => n.daysRemaining <= 7);
      const restockedToday = active.filter(n => n.updatedTime >= todayStart).length;
      const restockedThisWeek = active.filter(n => n.updatedTime >= weekStart).length;
      const restockedLast15Days = active.filter(n => n.updatedTime >= fifteenDaysStart).length;
      const totalProducts = totalResult.count ?? 0;
      const activeCount = active.length;

      // Find top supplier
      const supplierCounts = new Map<string, number>();
      for (const n of active) {
        if (n.supplierId) {
          supplierCounts.set(n.supplierId, (supplierCounts.get(n.supplierId) ?? 0) + 1);
        }
      }

      let topSupplierId: string | null = null;
      let topSupplierCount = 0;
      for (const [id, count] of supplierCounts) {
        if (count > topSupplierCount) {
          topSupplierCount = count;
          topSupplierId = id;
        }
      }

      let topSupplierName: string | null = null;
      if (topSupplierId) {
        try {
          const supResult = await invokeExternalDb<{ name: string }>({
            table: 'suppliers',
            operation: 'select',
            select: 'name',
            filters: { id: topSupplierId },
            limit: 1,
          });
          topSupplierName = supResult.records[0]?.name ?? null;
        } catch {
          // Graceful fallback — supplier name unavailable
        }
      }

      return {
        totalReplenishments: replenishments.length,
        activeReplenishments: activeCount,
        expiringSoon: expiring.length,
        totalProducts,
        replenishmentRate: totalProducts > 0 ? Math.round((activeCount / totalProducts) * 100) : 0,
        restockedToday,
        restockedThisWeek,
        restockedLast15Days,
        topSupplierName,
        topSupplierCount,
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

      const result = await invokeExternalDb<RawProduct>({
        table: 'products',
        operation: 'select',
        select: 'id, created_at, updated_at',
        filters: { is_active: true, updated_at: `gte.${cutoff}` },
        limit: 500,
      });

      return result.records.filter(isReplenishment).length;
    },
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}
