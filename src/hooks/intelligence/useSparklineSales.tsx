/**
 * Batch sparkline data provider.
 * Fetches aggregated daily market activity (units_depleted) from supplier
 * stock_daily_summary via external-db-bridge, avoiding N+1 queries.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

// Per-product sparkline data
export interface SparklineSalesData {
  /** Daily depleted quantities (ordered by date ascending), last 90 days */
  dailyQty: number[];
  totalQty: number;
  /** Total units replenished in the period */
  totalReplenished: number;
  /** Current available stock across all supplier sources */
  availableStock: number;
}

/** Window length in days for the sales aggregation. */
export const SPARKLINE_WINDOW_DAYS = 90;

type SparklineMap = Record<string, SparklineSalesData>;

const SparklineCtx = createContext<SparklineMap>({});

export function useSparklineData(productId: string): SparklineSalesData | undefined {
  const map = useContext(SparklineCtx);
  return map[productId];
}

interface Props {
  productIds: string[];
  children: ReactNode;
}

/**
 * Wrap a product list/grid with this provider.
 * It fetches stock_daily_summary for the given product IDs in bulk.
 */
export function SparklineSalesProvider({ productIds, children }: Props) {
  const stableIds = useMemo(() => {
    const unique = [...new Set(productIds)];
    unique.sort();
    return unique;
  }, [productIds]);

  const { data: sparkMap } = useQuery({
    queryKey: ['sparkline-supplier-batch', stableIds],
    queryFn: () => fetchSupplierSparklineBatch(stableIds),
    enabled: stableIds.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const value = sparkMap ?? {};

  return <SparklineCtx.Provider value={value}>{children}</SparklineCtx.Provider>;
}

// ---------- Data fetching ----------

interface StockDailySummaryRow {
  product_id: string;
  summary_date: string;
  units_depleted: number | null;
  units_restocked: number | null;
  stock_close: number | null;
  [key: string]: unknown;
}

// Rows are keyed by (variant_supplier_source_id, summary_date), so a single
// product/day can have multiple rows (one per supplier source). We page
// through results in chunks of 1000 to avoid silent row truncation.
const PAGE_SIZE = 1000;

// Use local calendar date to avoid UTC midnight shifting the boundary by one
// day for users in negative-offset timezones (e.g. BRT = UTC-3).
function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

async function fetchSupplierSparklineBatch(productIds: string[]): Promise<SparklineMap> {
  if (!productIds.length) return {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SPARKLINE_WINDOW_DAYS);
  const cutoffStr = toLocalDateStr(cutoff);

  const BATCH_SIZE = 50;
  const allRecords: StockDailySummaryRow[] = [];

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    let offset = 0;

    while (true) {
      try {
        const result = await dbInvoke<StockDailySummaryRow>({
          table: 'stock_daily_summary',
          operation: 'select',
          select: 'product_id, summary_date, units_depleted, units_restocked, stock_close',
          filters: {
            product_id: batch,
            summary_date: { op: 'gte', value: cutoffStr },
          },
          limit: PAGE_SIZE,
          offset,
          orderBy: { column: 'summary_date', ascending: true },
        });
        const page = result.records || [];
        allRecords.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      } catch (err) {
        logger.warn('[sparkline] Failed to fetch stock_daily_summary batch:', err);
        break;
      }
    }
  }

  // Build per-product aggregation maps
  const depletedByDate: Record<string, Record<string, number>> = {};
  const stockCloseByDate: Record<string, Record<string, number>> = {};
  const totalRestockedMap: Record<string, number> = {};

  for (const row of allRecords) {
    if (!row.product_id) continue;
    const date = row.summary_date?.substring(0, 10);
    if (!date) continue;

    if (!depletedByDate[row.product_id]) depletedByDate[row.product_id] = {};
    depletedByDate[row.product_id][date] =
      (depletedByDate[row.product_id][date] || 0) + (row.units_depleted || 0);

    // Only track dates where at least one source has a real stock value;
    // price-only rows have stock_close=null and must not contribute 0.
    if (row.stock_close !== null && row.stock_close !== undefined) {
      if (!stockCloseByDate[row.product_id]) stockCloseByDate[row.product_id] = {};
      stockCloseByDate[row.product_id][date] =
        (stockCloseByDate[row.product_id][date] || 0) + row.stock_close;
    }

    totalRestockedMap[row.product_id] =
      (totalRestockedMap[row.product_id] || 0) + (row.units_restocked || 0);
  }

  // Generate contiguous 30-day arrays
  const result: SparklineMap = {};
  const today = new Date();

  for (const pid of productIds) {
    const dailyQty: number[] = [];
    let totalQty = 0;
    const dateMap = depletedByDate[pid] || {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = toLocalDateStr(d);
      const depleted = dateMap[ds] ?? 0;
      dailyQty.push(depleted);
      totalQty += depleted;
    }

    const stockByDate = stockCloseByDate[pid] || {};
    const latestDate = Object.keys(stockByDate).sort().pop();
    const availableStock = latestDate ? (stockByDate[latestDate] ?? 0) : 0;

    result[pid] = {
      dailyQty,
      totalQty,
      totalReplenished: totalRestockedMap[pid] || 0,
      availableStock,
    };
  }

  return result;
}
