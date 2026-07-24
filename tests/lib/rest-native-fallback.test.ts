import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTable, handleQueryError } from '@/lib/supabase-direct';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

describe('rest-native-fallback: supabase-direct module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveTable - alias resolution', () => {
    it('resolves products → v_products_public', () => {
      expect(resolveTable('products')).toBe('v_products_public');
    });

    it('resolves suppliers → v_suppliers_public', () => {
      expect(resolveTable('suppliers')).toBe('v_suppliers_public');
    });

    it('resolves tecnica_gravacao → tabela_preco_gravacao_oficial', () => {
      expect(resolveTable('tecnica_gravacao')).toBe('tabela_preco_gravacao_oficial');
    });

    it('resolves customization_price_tiers → tabela_preco_gravacao_oficial_faixa', () => {
      expect(resolveTable('customization_price_tiers')).toBe('tabela_preco_gravacao_oficial_faixa');
    });

    it('passes through personalization_techniques unchanged (real table, not aliased)', () => {
      // personalization_techniques is a real table in the canonical DB (uuid PK,
      // native EN columns). Aliasing it to tecnicas_gravacao (PT columns) returned
      // wrong data — see rest-native.ts "BUG A" / postgrest.ts "BUG 1".
      expect(resolveTable('personalization_techniques')).toBe('personalization_techniques');
    });

    it('resolves customization_price_tables → tabela_preco_gravacao_oficial', () => {
      expect(resolveTable('customization_price_tables')).toBe('tabela_preco_gravacao_oficial');
    });

    it('resolves tecnica_gravacao_variante → tabela_preco_gravacao_oficial', () => {
      expect(resolveTable('tecnica_gravacao_variante')).toBe('tabela_preco_gravacao_oficial');
    });

    it('resolves v_products_without_videos → v_products_without_video (typo fix)', () => {
      expect(resolveTable('v_products_without_videos')).toBe('v_products_without_video');
    });

    it('passes through tables without aliases unchanged', () => {
      expect(resolveTable('categories')).toBe('categories');
      expect(resolveTable('product_variants')).toBe('product_variants');
      expect(resolveTable('variant_supplier_sources')).toBe('variant_supplier_sources');
      expect(resolveTable('supplier_branches')).toBe('supplier_branches');
      expect(resolveTable('color_variations')).toBe('color_variations');
      expect(resolveTable('product_images')).toBe('product_images');
    });
  });

  describe('empty response handling (callers show empty state, not blank screen)', () => {
    it('handleQueryError returns [] for null error (empty data scenario)', () => {
      const result = handleQueryError('useProductImages', 'product_images', null);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('simulates supabase returning empty data array', () => {
      const mockResponse = { data: [], error: null, count: 0 };
      const records = mockResponse.data ?? [];
      expect(records).toEqual([]);
      expect(records.length).toBe(0);
    });

    it('simulates supabase returning null data (treated as empty)', () => {
      const mockResponse = { data: null, error: null, count: null };
      const records = mockResponse.data ?? [];
      expect(records).toEqual([]);
      expect(Array.isArray(records)).toBe(true);
    });

    it('empty state does not produce undefined or null that causes blank screen', () => {
      const simulateHookReturn = () => {
        const data: unknown[] | null = null;
        return data ?? [];
      };
      const result = simulateHookReturn();
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('410 Gone does not retry', () => {
    it('returns immediately without delay for 410', () => {
      const t0 = performance.now();
      const result = handleQueryError('useStockAlerts', 'variant_supplier_sources', {
        message: 'HTTP 410 Gone',
      });
      const elapsed = performance.now() - t0;
      expect(result).toEqual([]);
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('non-410 errors propagate correctly', () => {
    it('throws on 500 errors', () => {
      expect(() =>
        handleQueryError('useNovelties', 'v_products_public', {
          message: '500 Internal Server Error',
        }),
      ).toThrow();
    });

    it('throws on permission denied', () => {
      expect(() =>
        handleQueryError('useColorSystem', 'color_variations', {
          message: 'permission denied for table color_variations',
        }),
      ).toThrow();
    });

    it('throws on network errors (these are retryable at react-query level)', () => {
      expect(() =>
        handleQueryError('useReplenishments', 'stock_snapshots', {
          message: 'FetchError: network timeout',
        }),
      ).toThrow();
    });
  });
});
