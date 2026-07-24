import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleQueryError, isGoneError } from '@/lib/supabase-direct';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

describe('stockFetcher 410 Gone handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGoneError', () => {
    it('detects 410 in error message', () => {
      expect(isGoneError({ message: 'rest-native error (variant_supplier_sources): 410 Gone' })).toBe(true);
    });

    it('detects "Gone" keyword in error message', () => {
      expect(isGoneError({ message: 'The bridge service has Gone away' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isGoneError({ message: 'network timeout' })).toBe(false);
      expect(isGoneError({ message: '500 Internal Server Error' })).toBe(false);
    });

    it('returns false for null error', () => {
      expect(isGoneError(null)).toBe(false);
    });
  });

  describe('handleQueryError', () => {
    it('returns empty array for 410 Gone errors (no crash)', () => {
      const result = handleQueryError(
        'useStockAlerts',
        'variant_supplier_sources',
        { message: '410 Gone - bridge deprecated' },
      );
      expect(result).toEqual([]);
    });

    it('returns empty array for Gone keyword errors', () => {
      const result = handleQueryError(
        'useStockAlerts',
        'variant_supplier_sources',
        { message: 'The requested resource is Gone' },
      );
      expect(result).toEqual([]);
    });

    it('throws for non-410 errors (propagates to ErrorBoundary)', () => {
      expect(() =>
        handleQueryError(
          'useStockAlerts',
          'variant_supplier_sources',
          { message: '500 Internal Server Error' },
        ),
      ).toThrow('[useStockAlerts] Query error on variant_supplier_sources: 500 Internal Server Error');
    });

    it('does NOT retry on 410 (returns immediately)', () => {
      const start = performance.now();
      const result = handleQueryError(
        'useReplenishments',
        'stock_snapshots',
        { message: 'HTTP 410: bridge descontinuada' },
      );
      const elapsed = performance.now() - start;
      expect(result).toEqual([]);
      expect(elapsed).toBeLessThan(50);
    });

    it('returns empty array (not undefined) for null error', () => {
      const result = handleQueryError('useStockAlerts', 'products', null);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('hook-level 410 resilience patterns', () => {
    it('simulates a hook returning [] on 410 instead of crashing', async () => {
      const mockSupabaseFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: '410 Gone' },
            }),
          }),
        }),
      });

      const fetchStock = async () => {
        const { data, error } = await mockSupabaseFrom('variant_supplier_sources')
          .select('*')
          .eq('is_active', true)
          .limit(100);
        if (error) return handleQueryError('useStockAlerts', 'variant_supplier_sources', error);
        return data ?? [];
      };

      const result = await fetchStock();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('does not produce undefined that would cause blank screen', async () => {
      const fetchData = async () => {
        const error = { message: 'Resource Gone (410)' };
        return handleQueryError('useReplenishments', 'products', error);
      };

      const result = await fetchData();
      expect(result).not.toBeUndefined();
      expect(result).not.toBeNull();
      expect(result).toEqual([]);
    });
  });
});
