/**
 * Batch sparkline data provider.
 * Fetches aggregated daily market activity (units_depleted) from supplier
 * stock_daily_summary via external-db-bridge, avoiding N+1 queries.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';

// Per-product sparkline data
export interface SparklineSalesData {
  /** Daily depleted quantities (ordered by date ascending), last 30 days */
  dailyQty: number[];
  totalQty: number;
  /** Total units replenished in the period */
  totalReplenished: number;
  /** Current available stock across all supplier sources */
  availableStock: number;
}

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
  [key: string]: unknown;
}

async function fetchSupplierSparklineBatch(productIds: string[]): Promise<SparklineMap> {
  if (!productIds.length) return {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().substring(0, 10);

  // Fetch in batches of 50 product IDs to avoid query size limits
  const BATCH_SIZE = 50;
  const allRecords: StockDailySummaryRow[] = [];

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    try {
      const result = await invokeExternalDb<StockDailySummaryRow>({
        table: 'stock_daily_summary',
        operation: 'select',
        select: 'product_id, summary_date, units_depleted',
        filters: {
          product_id: `in.(${batch.join(',')})`,
          summary_date: `gte.${cutoffStr}`,
        },
        limit: batch.length * 31,
        orderBy: { column: 'summary_date', ascending: true },
      });
      allRecords.push(...(result.records || []));
    } catch (err) {
      logger.warn('[sparkline] Failed to fetch stock_daily_summary batch:', err);
    }
  }

  // Build per-product, per-date map
  const map: Record<string, Record<string, number>> = {};

  for (const row of allRecords) {
    if (!row.product_id) continue;
    const date = row.summary_date?.substring(0, 10);
    if (!date) continue;
    if (!map[row.product_id]) map[row.product_id] = {};
    map[row.product_id][date] = (map[row.product_id][date] || 0) + (row.units_depleted || 0);
  }

  // Generate contiguous 30-day arrays
  const result: SparklineMap = {};
  const today = new Date();

  for (const pid of productIds) {
    const dailyQty: number[] = [];
    let totalQty = 0;
    const dateMap = map[pid] || {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().substring(0, 10);
      const depleted = dateMap[ds] ?? 0;
      dailyQty.push(depleted);
      totalQty += depleted;
    }

    result[pid] = {
      dailyQty,
      totalQty,
      totalReplenished: 0,
      availableStock: 0,
    };
  }

  return result;
}
