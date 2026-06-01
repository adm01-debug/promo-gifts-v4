/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  aggregateDailySummaryByDate,
  extractUniqueSupplierIds,
  getActiveFlags,
  type StockDailySummary,
  type ProductIntelligenceData,
} from '../useStockHistory';

describe('useStockHistory helpers', () => {
  describe('aggregateDailySummaryByDate', () => {
    const mockSummaries: StockDailySummary[] = [
      {
        id: 1,
        summary_date: '2024-01-01',
        supplier_id: 'S1',
        stock_close: 100,
        units_depleted: 10,
        units_restocked: 0,
        restock_detected: false,
        cost_price_close: 10,
        product_id: 'P1',
        variant_id: 'V1',
        variant_supplier_source_id: 'VSS1',
        supplier_branch_id: null,
        stock_open: 110,
        stock_min: 100,
        stock_max: 110,
        net_change: -10,
        restock_quantity: 0,
        restock_count: 0,
        cost_price_open: 10,
        price_changed: false,
        sync_count: 1,
      },
      {
        id: 2,
        summary_date: '2024-01-01',
        supplier_id: 'S2',
        stock_close: 200,
        units_depleted: 20,
        units_restocked: 50,
        restock_detected: true,
        cost_price_close: 20,
        product_id: 'P1',
        variant_id: 'V1',
        variant_supplier_source_id: 'VSS2',
        supplier_branch_id: null,
        stock_open: 170,
        stock_min: 170,
        stock_max: 220,
        net_change: 30,
        restock_quantity: 50,
        restock_count: 1,
        cost_price_open: 20,
        price_changed: false,
        sync_count: 1,
      },
      {
        id: 3,
        summary_date: '2024-01-02',
        supplier_id: 'S1',
        stock_close: 90,
        units_depleted: 10,
        units_restocked: 0,
        restock_detected: false,
        cost_price_close: 11,
        product_id: 'P1',
        variant_id: 'V1',
        variant_supplier_source_id: 'VSS1',
        supplier_branch_id: null,
        stock_open: 100,
        stock_min: 90,
        stock_max: 100,
        net_change: -10,
        restock_quantity: 0,
        restock_count: 0,
        cost_price_open: 10,
        price_changed: true,
        sync_count: 1,
      },
    ];

    it('should aggregate data by date for all suppliers', () => {
      const result = aggregateDailySummaryByDate(mockSummaries);
      expect(result).toHaveLength(2);

      // 2024-01-01 aggregation
      expect(result[0]).toMatchObject({
        date: '2024-01-01',
        stockClose: 300, // 100 + 200
        depleted: 30, // 10 + 20
        restocked: 50,
        restockDetected: true,
      });

      // B17: weighted average cost (10*100 + 20*200) / (100+200) = (1000 + 4000) / 300 = 16.666...
      expect(result[0].costPriceClose).toBeCloseTo(16.67, 2);
    });

    it('should filter by supplier_id if provided', () => {
      const result = aggregateDailySummaryByDate(mockSummaries, 'S1');
      expect(result).toHaveLength(2);
      expect(result[0].stockClose).toBe(100);
      expect(result[1].stockClose).toBe(90);
    });

    it('should return empty array if summaries is empty', () => {
      expect(aggregateDailySummaryByDate([])).toEqual([]);
    });

    it('should handle missing cost price correctly', () => {
      const summaries: StockDailySummary[] = [
        {
          summary_date: '2024-01-01',
          stock_close: 100,
          cost_price_close: null,
          supplier_id: 'S1',
          units_depleted: 0,
          units_restocked: 0,
          restock_detected: false,
        } as any,
      ];
      const result = aggregateDailySummaryByDate(summaries);
      expect(result[0].costPriceClose).toBeNull();
    });

    it('should calculate weighted cost only for suppliers with stock > 0', () => {
      const summaries: StockDailySummary[] = [
        {
          summary_date: '2024-01-01',
          stock_close: 100,
          cost_price_close: 10,
          supplier_id: 'S1',
        } as any,
        {
          summary_date: '2024-01-01',
          stock_close: 0,
          cost_price_close: 50, // Should be ignored
          supplier_id: 'S2',
        } as any,
      ];
      const result = aggregateDailySummaryByDate(summaries);
      expect(result[0].costPriceClose).toBe(10);
    });
  });

  describe('extractUniqueSupplierIds', () => {
    it('should return unique supplier ids', () => {
      const data = [
        { supplier_id: 'S1' },
        { supplier_id: 'S2' },
        { supplier_id: 'S1' },
      ] as StockDailySummary[];
      expect(extractUniqueSupplierIds(data)).toEqual(['S1', 'S2']);
    });
  });

  describe('getActiveFlags', () => {
    it('should return correct flags based on data', () => {
      const data: ProductIntelligenceData = {
        is_hot_product: true,
        is_stockout_risk: true,
        is_stagnant: false,
        is_negotiation_opportunity: true,
        has_frequent_restock: false,
        abc_classification: 'A',
        product_id: 'P1',
        supplier_count: 2,
        total_current_stock: 100,
        total_depleted_7d: 10,
        total_depleted_30d: 40,
        total_depleted_90d: 120,
        total_restocked_30d: 50,
        avg_velocity_7d: 1.4,
        avg_velocity_30d: 1.3,
        max_velocity_trend: 1.1,
        min_days_to_stockout: 5,
        turnover_score: 80,
      };

      const flags = getActiveFlags(data);
      expect(flags).toContain('hot-product');
      expect(flags).toContain('stockout-risk');
      expect(flags).toContain('negotiation-opportunity');
      expect(flags).toContain('class-a');
      expect(flags).not.toContain('stagnant');
      expect(flags).not.toContain('frequent-restock');
    });

    it('should return empty array if no data', () => {
      expect(getActiveFlags(null)).toEqual([]);
    });

    it('should handle each flag individually', () => {
      const base: ProductIntelligenceData = {
        product_id: 'P1',
        abc_classification: 'C',
      } as any;

      expect(getActiveFlags({ ...base, is_hot_product: true })).toEqual(['hot-product']);
      expect(getActiveFlags({ ...base, is_stockout_risk: true })).toEqual(['stockout-risk']);
      expect(getActiveFlags({ ...base, is_stagnant: true })).toEqual(['stagnant']);
      expect(getActiveFlags({ ...base, is_negotiation_opportunity: true })).toEqual([
        'negotiation-opportunity',
      ]);
      expect(getActiveFlags({ ...base, has_frequent_restock: true })).toEqual(['frequent-restock']);
      expect(getActiveFlags({ ...base, abc_classification: 'A' })).toEqual(['class-a']);
    });
  });
});
