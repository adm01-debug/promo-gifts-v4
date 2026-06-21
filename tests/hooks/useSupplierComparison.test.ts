import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useSupplierComparison,
  getSupplierProductsInCategory,
  normalizeMaterials,
  normalizeColorNames,
  computeScore,
  jaccard,
  intersect,
  nameSimilarity,
  tokenize,
  stripAccents
} from '@/hooks/products/useSupplierComparison';
import { Product } from '@/types/product-catalog';

// Mock products data
const mockBaseProduct: Product = {
  id: 'base-1',
  name: 'Caneca de Cerâmica 350ml',
  price: 50.0,
  sku: 'BASE-01',
  stock: 100,
  colors: [{ name: 'Branco', hex: '#FFF', group: 'Branco' }],
  materials: ['Cerâmica'],
  category: { id: 'cat-1', name: 'Canecas' },
  supplier: { id: 'supp-1', name: 'S1' },
  stockStatus: 'in-stock',
  images: [],
  minQuantity: 50,
  featured: false,
  newArrival: false,
  onSale: false,
  isKit: false,
  tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
  is_active: true,
};

const mockAlt1: Product = {
  ...mockBaseProduct,
  id: 'alt-1',
  name: 'Caneca Cerâmica Branca',
  price: 40.0,
  sku: 'ALT-01',
  stock: 200,
  supplier: { id: 'supp-2', name: 'S2' },
};

const mockAlt2: Product = {
  ...mockBaseProduct,
  id: 'alt-2',
  name: 'Copo Térmico', // Not similar enough
  price: 30.0,
  sku: 'ALT-02',
  category: { id: 'cat-1', name: 'Canecas' },
  supplier: { id: 'supp-3', name: 'S3' },
};

// Mock useProducts hook
const mockUseProducts = vi.fn();
vi.mock('@/hooks/products/useProducts', () => ({
  useProducts: (...args: any[]) => mockUseProducts(...args),
}));

describe('useSupplierComparison', () => {
  it('should return null when no product is provided', () => {
    mockUseProducts.mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useSupplierComparison(null));
    expect(result.current.result).toBeNull();
  });

  it('should query by category name when the product has no category id', () => {
    mockUseProducts.mockReturnValue({ data: [], isLoading: false });
    const productSemId = {
      ...mockBaseProduct,
      category: { name: 'Canecas' },
    } as Product;
    const { result } = renderHook(() => useSupplierComparison(productSemId));
    // Sem alternativas (data vazia) → result null; o ramo `category: name` foi avaliado.
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
    // 2º argumento (options.enabled) deve ser true pois há categoryName.
    expect(mockUseProducts).toHaveBeenCalledWith(
      { category: 'Canecas', limit: 1000 },
      expect.objectContaining({ enabled: true }),
    );
  });

  it('should pass undefined filters when the product has no category at all', () => {
    mockUseProducts.mockReturnValue({ data: [], isLoading: false });
    const productSemCategoria = {
      ...mockBaseProduct,
      category: undefined,
    } as unknown as Product;
    const { result } = renderHook(() => useSupplierComparison(productSemCategoria));
    expect(result.current.result).toBeNull();
    expect(mockUseProducts).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: false }),
    );
  });

  it('should filter and rank alternatives correctly', () => {
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, mockAlt1, mockAlt2], 
      isLoading: false 
    });

    const { result } = renderHook(() => useSupplierComparison(mockBaseProduct));
    
    expect(result.current.result).not.toBeNull();
    const comparison = result.current.result!;
    
    // Alt 1 should be included, Alt 2 should be filtered out by similarity
    expect(comparison.alternatives).toHaveLength(1);
    expect(comparison.alternatives[0].product.id).toBe('alt-1');
    
    // Metrics check
    expect(comparison.lowestPrice).toBe(40.0);
    expect(comparison.highestStock).toBe(200);
    expect(comparison.alternatives[0].priceDiff).toBe(-10.0);
    expect(comparison.alternatives[0].isLowestPrice).toBe(true);
    expect(comparison.alternatives[0].isBestStock).toBe(true);
  });

  it('should respect the onlyVerified option', () => {
    const inactiveAlt = { ...mockAlt1, id: 'alt-inactive', is_active: false };
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, mockAlt1, inactiveAlt], 
      isLoading: false 
    });

    // Test with onlyVerified: true
    const { result: resVerified } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { onlyVerified: true })
    );
    expect(resVerified.current.result?.alternatives).toHaveLength(1);
    expect(resVerified.current.result?.alternativesUnfiltered).toHaveLength(2);

    // Test with onlyVerified: false
    const { result: resAll } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { onlyVerified: false })
    );
    expect(resAll.current.result?.alternatives).toHaveLength(2);
  });

  it('should sort alternatives by different criteria', () => {
    const altExpensive = { ...mockAlt1, id: 'alt-expensive', price: 100.0, stock: 1000 };
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, mockAlt1, altExpensive], 
      isLoading: false 
    });

    // Sort by price
    const { result: resPrice } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { sortBy: 'price' })
    );
    expect(resPrice.current.result?.alternatives[0].product.id).toBe('alt-1');

    // Sort by stock
    const { result: resStock } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { sortBy: 'stock' })
    );
    expect(resStock.current.result?.alternatives[0].product.id).toBe('alt-expensive');

    // Sort by leadTime
    const altFast = { ...mockAlt1, id: 'alt-fast', leadTimeDays: 2 };
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, mockAlt1, altFast], 
      isLoading: false 
    });
    const { result: resLead } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { sortBy: 'leadTime' })
    );
    expect(resLead.current.result?.alternatives[0].product.id).toBe('alt-fast');

    // Sort by commonColors
    const altManyColors = { ...mockAlt1, id: 'alt-colors', colors: [
      { name: 'Branco', hex: '#FFF' },
      { name: 'Azul', hex: '#00F' }
    ]};
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, mockAlt1, altManyColors], 
      isLoading: false 
    });
    const { result: resColors } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { sortBy: 'commonColors' })
    );
    // alt-colors has 1 common color (Branco), alt-1 also has 1. 
    // Wait, mockBaseProduct has 1 color (Branco).
    // Let's make one have 0.
    const altNoColors = { ...mockAlt1, id: 'alt-no-colors', colors: [{ name: 'Preto', hex: '#000' }] };
    mockUseProducts.mockReturnValue({ 
      data: [mockBaseProduct, altNoColors, altManyColors], 
      isLoading: false 
    });
    const { result: resColors2 } = renderHook(() => 
      useSupplierComparison(mockBaseProduct, { sortBy: 'commonColors' })
    );
    expect(resColors2.current.result?.alternatives[0].product.id).toBe('alt-colors');

    // Default sort (score)
    const { result: resDefault } = renderHook(() => 
      useSupplierComparison(mockBaseProduct)
    );
    expect(resDefault.current.result?.alternatives).toBeDefined();
  });

  describe('getSupplierProductsInCategory', () => {
    it('should group products by supplier correctly', () => {
      const products = [
        { ...mockBaseProduct, supplier: { id: 's1' }, category: { id: 'c1' } },
        { ...mockBaseProduct, id: 'p2', supplier: { id: 's1' }, category: { id: 'c1' } },
        { ...mockBaseProduct, id: 'p3', supplier: { id: 's2' }, category: { id: 'c1' } },
        { ...mockBaseProduct, id: 'p4', supplier: { id: 's1' }, category: { id: 'c2' } }, // different category
      ];
      
      const map = getSupplierProductsInCategory(products, 'c1');
      expect(map.size).toBe(2);
      expect(map.get('s1')).toHaveLength(2);
      expect(map.get('s2')).toHaveLength(1);
    });
  });

  describe('helpers', () => {
    it('normalizeMaterials should handle non-array', () => {
      expect(normalizeMaterials(null as any)).toEqual([]);
      expect(normalizeMaterials(undefined as any)).toEqual([]);
    });

    it('normalizeColorNames should handle non-array', () => {
      expect(normalizeColorNames(null as any)).toEqual([]);
    });
  });

  // Cobertura determinística dos branches dos helpers puros exportados.
  describe('pure helpers — branch coverage', () => {
    it('stripAccents removes diacritics and is a no-op for ASCII', () => {
      expect(stripAccents('Caneca Ré-Açaí ÔÜ')).toBe('Caneca Re-Acai OU');
      expect(stripAccents('plain')).toBe('plain');
    });

    it('tokenize handles null/undefined/empty and punctuation', () => {
      expect(tokenize(null).size).toBe(0);
      expect(tokenize(undefined).size).toBe(0);
      expect(tokenize('   ').size).toBe(0);
      const t = tokenize('Caneca de Cerâmica, 350ml!');
      expect(t.has('caneca')).toBe(true);
      expect(t.has('ceramica')).toBe(true);
    });

    it('jaccard returns 0 when either set is empty (both || sides)', () => {
      expect(jaccard([], ['a'])).toBe(0); // setA vazio (1º lado do ||)
      expect(jaccard(['a'], [])).toBe(0); // setB vazio (2º lado do ||)
      expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 5);
      expect(jaccard(['x'], ['y'])).toBe(0); // sem interseção
    });

    it('nameSimilarity delegates to jaccard over token sets', () => {
      expect(nameSimilarity(new Set(['a']), new Set(['a']))).toBe(1);
      expect(nameSimilarity(new Set(['a']), new Set())).toBe(0);
    });

    it('intersect keeps only common items, in order of the first array', () => {
      expect(intersect(['a', 'b', 'c'], ['c', 'a'])).toEqual(['a', 'c']);
      expect(intersect(['a'], ['z'])).toEqual([]);
      expect(intersect([], ['a'])).toEqual([]);
    });

    it('computeScore covers every weighted branch (stock/colors/lead/verified)', () => {
      // Caminho "tudo presente": highestStock>0, maxCommonColors>0, lead numérico+maxLead>0, verificado
      const full = computeScore({
        priceDiffPercent: -50,
        stock: 100,
        highestStock: 100,
        leadTimeDays: 0,
        maxLead: 10,
        commonColors: 3,
        maxCommonColors: 3,
        isVerified: true,
      });
      expect(full).toBe(100);

      // Caminho "tudo ausente/zero": highestStock=0, maxCommonColors=0, lead null, não verificado
      const empty = computeScore({
        priceDiffPercent: 50,
        stock: 0,
        highestStock: 0,
        leadTimeDays: null,
        maxLead: 0,
        commonColors: 0,
        maxCommonColors: 0,
        isVerified: false,
      });
      // preço=0, estoque=0, cores=0, lead=neutro(0.5*10=5), verificado=0 → 5
      expect(empty).toBe(5);

      // leadTimeDays numérico mas maxLead=0 → cai no neutro 0.5
      const neutralLead = computeScore({
        priceDiffPercent: 0,
        stock: 50,
        highestStock: 100,
        leadTimeDays: 5,
        maxLead: 0,
        commonColors: 1,
        maxCommonColors: 2,
        isVerified: true,
      });
      expect(Number.isFinite(neutralLead)).toBe(true);
    });
  });
});

