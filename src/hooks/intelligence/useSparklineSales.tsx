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

interface SparklineCtxValue {
  byProduct: Record<string, SparklineSalesData>;
  byVariant: Record<string, SparklineSalesData>;
}

const SparklineCtx = createContext<SparklineCtxValue>({ byProduct: {}, byVariant: {} });

export function useSparklineData(productId: string): SparklineSalesData | undefined {
  const { byProduct } = useContext(SparklineCtx);
  return byProduct[productId];
}

/** Dados agregados para uma variante específica (cor/SKU). */
export function useSparklineDataByVariant(
  variantId: string | null | undefined,
): SparklineSalesData | undefined {
  const { byVariant } = useContext(SparklineCtx);
  return variantId ? byVariant[variantId] : undefined;
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

  const { data: sparkData } = useQuery({
    queryKey: ['sparkline-supplier-batch', stableIds],
    queryFn: () => fetchSupplierSparklineBatch(stableIds),
    enabled: stableIds.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const value = sparkData ?? { byProduct: {}, byVariant: {} };

  return <SparklineCtx.Provider value={value}>{children}</SparklineCtx.Provider>;
}

// ---------- Data fetching ----------

interface StockDailySummaryRow {
  product_id: string;
  variant_id: string | null;
  summary_date: string;
  units_depleted: number | null;
  units_restocked: number | null;
  stock_close: number | null;
  [key: string]: unknown;
}

const PAGE_SIZE = 1000;

function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

async function fetchSupplierSparklineBatch(productIds: string[]): Promise<SparklineCtxValue> {
  if (!productIds.length) return { byProduct: {}, byVariant: {} };

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
          select:
            'product_id, variant_id, summary_date, units_depleted, units_restocked, stock_close',
          filters: {
            product_id: batch,
            summary_date: { op: 'gte', value: cutoffStr },
          },
          limit: PAGE_SIZE,
          offset,
          orderBy: { column: 'summary_date', ascending: true },
        });
        const page = result.records ?? [];
        allRecords.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      } catch (err) {
        logger.warn('[sparkline] Failed to fetch stock_daily_summary batch:', err);
        break;
      }
    }
  }

  // Agregação dupla: por product_id (pai) e por variant_id (filho)
  const depletedByDate = {
    product: {} as Record<string, Record<string, number>>,
    variant: {} as Record<string, Record<string, number>>,
  };
  const stockCloseByDate = {
    product: {} as Record<string, Record<string, number>>,
    variant: {} as Record<string, Record<string, number>>,
  };
  const totalRestocked = {
    product: {} as Record<string, number>,
    variant: {} as Record<string, number>,
  };
  const variantIdsSeen = new Set<string>();

  for (const row of allRecords) {
    if (!row.product_id) continue;
    const date = row.summary_date?.substring(0, 10);
    if (!date) continue;
    const depleted = row.units_depleted || 0;
    const restocked = row.units_restocked || 0;

    // Pai
    if (!depletedByDate.product[row.product_id]) depletedByDate.product[row.product_id] = {};
    depletedByDate.product[row.product_id][date] =
      (depletedByDate.product[row.product_id][date] || 0) + depleted;

    if (row.stock_close !== null && row.stock_close !== undefined) {
      if (!stockCloseByDate.product[row.product_id]) stockCloseByDate.product[row.product_id] = {};
      stockCloseByDate.product[row.product_id][date] =
        (stockCloseByDate.product[row.product_id][date] || 0) + row.stock_close;
    }
    totalRestocked.product[row.product_id] =
      (totalRestocked.product[row.product_id] || 0) + restocked;

    // Variante
    if (row.variant_id) {
      const vid = row.variant_id;
      variantIdsSeen.add(vid);
      if (!depletedByDate.variant[vid]) depletedByDate.variant[vid] = {};
      depletedByDate.variant[vid][date] = (depletedByDate.variant[vid][date] || 0) + depleted;

      if (row.stock_close !== null && row.stock_close !== undefined) {
        if (!stockCloseByDate.variant[vid]) stockCloseByDate.variant[vid] = {};
        stockCloseByDate.variant[vid][date] =
          (stockCloseByDate.variant[vid][date] || 0) + row.stock_close;
      }
      totalRestocked.variant[vid] = (totalRestocked.variant[vid] || 0) + restocked;
    }
  }

  const today = new Date();

  function build(key: string, scope: 'product' | 'variant'): SparklineSalesData {
    const dailyQty: number[] = [];
    let totalQty = 0;
    const dateMap = depletedByDate[scope][key] || {};
    for (let i = SPARKLINE_WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = toLocalDateStr(d);
      const v = dateMap[ds] ?? 0;
      dailyQty.push(v);
      totalQty += v;
    }
    const stockByDate = stockCloseByDate[scope][key] || {};
    const latestDate = Object.keys(stockByDate).sort().pop();
    const availableStock = latestDate ? (stockByDate[latestDate] ?? 0) : 0;
    return {
      dailyQty,
      totalQty,
      totalReplenished: totalRestocked[scope][key] || 0,
      availableStock,
    };
  }

  const byProduct: Record<string, SparklineSalesData> = {};
  for (const pid of productIds) byProduct[pid] = build(pid, 'product');

  const byVariant: Record<string, SparklineSalesData> = {};
  for (const vid of variantIdsSeen) byVariant[vid] = build(vid, 'variant');

  return { byProduct, byVariant };
}
