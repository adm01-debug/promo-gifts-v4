/**
 * Hook para Inteligência de Mercado MACRO (agregada por todos os produtos).
 * Consome stock_daily_summary via external-db-bridge.
 * Retorna dados agregados + breakdown por fornecedor para comparação.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import type { StockDailySummary } from '@/hooks/intelligence/useStockHistory';

export interface MacroMarketPoint {
  date: string;
  stockClose: number;
  depleted: number;
  restocked: number;
}

export interface MacroSupplierMetrics {
  supplierId: string;
  avgDailyDepletion7d: number;
  currentStock: number;
  totalDepleted: number;
  totalRestocked: number;
  velocityTrend: number; // ratio 7d vs 30d
  daysToStockout: number | null;
}

export interface MacroMarketKpis {
  totalDepleted7d: number;
  totalDepleted30d: number;
  totalRestocked30d: number;
  totalCurrentStock: number;
  avgDailyDepletion: number;
  supplierCount: number;
  topDepletionDay: { date: string; value: number } | null;
}

export interface MacroMarketData {
  daily: MacroMarketPoint[];
  kpis: MacroMarketKpis;
  suppliers: MacroSupplierMetrics[];
  supplierIds: string[];
}

/**
 * Busca stock_daily_summary agregado (macro) para visão de mercado.
 * Filtra opcionalmente por supplier_id.
 */
export function useMarketIntelligenceMacro(days = 30, supplierId?: string | null) {
  return useQuery({
    queryKey: ['market-intelligence-macro', days, supplierId],
    queryFn: async (): Promise<MacroMarketData> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const filters: Record<string, unknown> = {};
      if (supplierId) filters.supplier_id = supplierId;

      const result = await dbInvoke<StockDailySummary>({
        table: 'stock_daily_summary',
        operation: 'select',
        select: 'summary_date, stock_close, units_depleted, units_restocked, supplier_id',
        filters,
        limit: 5000,
        orderBy: { column: 'summary_date', ascending: true },
      });

      // Aggregate by date (for chart)
      const dateMap = new Map<string, MacroMarketPoint>();
      // Per-supplier aggregation
      const supplierDataMap = new Map<
        string,
        {
          depleted7d: number;
          depleted30d: number;
          restocked30d: number;
          latestStock: number;
          latestDate: string;
          dailyDepleted7d: number[];
          dailyDepleted30d: number[];
        }
      >();
      const uniqueSuppliers = new Set<string>();

      const now = new Date();
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      const d7Str = d7.toISOString().split('T')[0];

      for (const row of result.records) {
        if (row.summary_date < cutoffStr) continue;

        // Global aggregation
        const existing = dateMap.get(row.summary_date);
        if (existing) {
          existing.stockClose += row.stock_close;
          existing.depleted += row.units_depleted;
          existing.restocked += row.units_restocked;
        } else {
          dateMap.set(row.summary_date, {
            date: row.summary_date,
            stockClose: row.stock_close,
            depleted: row.units_depleted,
            restocked: row.units_restocked,
          });
        }

        // Per-supplier aggregation
        if (row.supplier_id) {
          uniqueSuppliers.add(row.supplier_id);
          const sd = supplierDataMap.get(row.supplier_id) || {
            depleted7d: 0,
            depleted30d: 0,
            restocked30d: 0,
            latestStock: 0,
            latestDate: '',
            dailyDepleted7d: [],
            dailyDepleted30d: [],
          };
          sd.depleted30d += row.units_depleted;
          sd.restocked30d += row.units_restocked;
          sd.dailyDepleted30d.push(row.units_depleted);
          if (row.summary_date >= d7Str) {
            sd.depleted7d += row.units_depleted;
            sd.dailyDepleted7d.push(row.units_depleted);
          }
          if (!sd.latestDate || row.summary_date > sd.latestDate) {
            sd.latestStock = row.stock_close;
            sd.latestDate = row.summary_date;
          }
          supplierDataMap.set(row.supplier_id, sd);
        }
      }

      const daily = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

      // Global KPIs
      let totalDepleted7d = 0;
      let totalDepleted30d = 0;
      let totalRestocked30d = 0;
      let latestStock = 0;
      let topDepletionDay: { date: string; value: number } | null = null;

      for (const d of daily) {
        totalDepleted30d += d.depleted;
        totalRestocked30d += d.restocked;
        if (d.date >= d7Str) totalDepleted7d += d.depleted;
        latestStock = d.stockClose;
        if (!topDepletionDay || d.depleted > topDepletionDay.value) {
          topDepletionDay = { date: d.date, value: d.depleted };
        }
      }

      const activeDays = daily.filter((d) => d.depleted > 0).length;
      const avgDailyDepletion = activeDays > 0 ? totalDepleted30d / activeDays : 0;

      // Build supplier metrics
      const suppliers: MacroSupplierMetrics[] = [];
      supplierDataMap.forEach((sd, sid) => {
        const avg7d = sd.dailyDepleted7d.length > 0 ? sd.depleted7d / sd.dailyDepleted7d.length : 0;
        const avg30d =
          sd.dailyDepleted30d.length > 0 ? sd.depleted30d / sd.dailyDepleted30d.length : 0;
        const trend = avg30d > 0 ? avg7d / avg30d : 1;
        const daysToStockout = avg7d > 0 ? Math.round(sd.latestStock / avg7d) : null;

        suppliers.push({
          supplierId: sid,
          avgDailyDepletion7d: avg7d,
          currentStock: sd.latestStock,
          totalDepleted: sd.depleted30d,
          totalRestocked: sd.restocked30d,
          velocityTrend: trend,
          daysToStockout,
        });
      });

      suppliers.sort((a, b) => b.avgDailyDepletion7d - a.avgDailyDepletion7d);

      return {
        daily,
        kpis: {
          totalDepleted7d,
          totalDepleted30d,
          totalRestocked30d,
          totalCurrentStock: latestStock,
          avgDailyDepletion,
          supplierCount: uniqueSuppliers.size,
          topDepletionDay,
        },
        suppliers,
        supplierIds: [...uniqueSuppliers],
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}
