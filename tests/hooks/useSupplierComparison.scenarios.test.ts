
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSupplierComparison } from '@/hooks/products/useSupplierComparison';

// Mock useProducts
const mockUseProducts = vi.fn();
vi.mock('@/hooks/products/useProducts', () => ({
  useProducts: (...args: any[]) => mockUseProducts(...args),
}));

const baseProduct = {
  id: 'base',
  name: 'Caneca de Cerâmica Branca 300ml',
  price: 10.0,
  stock: 100,
  minQuantity: 50,
  supplier: { id: 'supp1', name: 'Fornecedor A' },
  category: { id: 'cat1', name: 'Canecas' },
  subcategory: 'Cerâmica',
  materials: ['Cerâmica'],
  colors: [{ name: 'Branco', hex: '#ffffff' }],
  is_active: true,
  stockStatus: 'in-stock'
};

describe('useSupplierComparison Real-world Scenarios', () => {
  it('should handle similarity matching with stopwords and accents', () => {
    const altProduct = {
      ...baseProduct,
      id: 'alt1',
      name: 'Caneca Ceramica Branca 300 ML', // Accents, spaces, casing
      supplier: { id: 'supp2', name: 'Fornecedor B' },
    };

    mockUseProducts.mockReturnValue({ data: [baseProduct, altProduct], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.alternatives).toHaveLength(1);
    expect(result.current.result?.alternatives[0].product.id).toBe('alt1');
  });

  it('should distinguish products with crucial 2-letter tokens like A4/A5', () => {
    const paperBase = {
      ...baseProduct,
      name: 'Caderno Executivo A4',
      category: { id: 'cat2', name: 'Papelaria' },
    };
    const paperAlt = {
      ...paperBase,
      id: 'alt2',
      name: 'Caderno Executivo A5',
      supplier: { id: 'supp2', name: 'Fornecedor B' },
    };

    mockUseProducts.mockReturnValue({ data: [paperBase, paperAlt], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(paperBase as any, { minNameSimilarity: 0.1 }));
    
    // Tokens for base: ["caderno", "executivo", "a4"]
    // Tokens for alt: ["caderno", "executivo", "a5"]
    // Intersection: ["caderno", "executivo"] (size 2)
    // Union: ["caderno", "executivo", "a4", "a5"] (size 4)
    // Jaccard: 2/4 = 0.5
    // Previous Jaccard was 2/2 = 1.0 because A4/A5 were ignored.
    
    const alt = result.current.result?.alternatives[0];
    expect(alt).toBeDefined();
    expect(alt?.score).toBeLessThan(100); // Should not be a perfect match anymore
  });

  it('should calculate MOQ savings correctly', () => {
    const altProduct = {
      ...baseProduct,
      id: 'alt1',
      price: 8.0, // 2.0 cheaper
      minQuantity: 100, // higher MOQ than base (50)
      supplier: { id: 'supp2', name: 'Fornecedor B' },
    };

    mockUseProducts.mockReturnValue({ data: [baseProduct, altProduct], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    
    const alt = result.current.result?.alternatives[0];
    // Savings = |10 - 8| * max(50, 100) = 2 * 100 = 200
    expect(alt?.economiaPorMOQ).toBe(200);
  });

  it('should rank verified suppliers higher', () => {
    const alt1 = { ...baseProduct, id: 'alt1', price: 9, is_active: false, supplier: { id: 's2', name: 'B' } };
    const alt2 = { ...baseProduct, id: 'alt2', price: 9.5, is_active: true, supplier: { id: 's3', name: 'C' } };

    mockUseProducts.mockReturnValue({ data: [baseProduct, alt1, alt2], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any, { sortBy: 'score' }));
    
    const alternatives = result.current.result?.alternatives;
    // alt2 should be first even if slightly more expensive because it's verified
    expect(alternatives?.[0].product.id).toBe('alt2');
  });

  it('should handle null lead times gracefully', () => {
     const alt1 = { ...baseProduct, id: 'alt1', leadTimeDays: 5, supplier: { id: 's2', name: 'B' } };
     const alt2 = { ...baseProduct, id: 'alt2', leadTimeDays: null, supplier: { id: 's3', name: 'C' } };

     mockUseProducts.mockReturnValue({ data: [baseProduct, alt1, alt2], isLoading: false });

     const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
     expect(result.current.result?.fastestLeadTimeDays).toBe(5);
  });

  it('should filter out products with invalid data (negative price)', () => {
    const corruptAlt = { 
      ...baseProduct, 
      id: 'corrupt', 
      price: -10, 
      stock: 100,
      supplier: { id: 's2', name: 'B' }
    };

    mockUseProducts.mockReturnValue({ data: [baseProduct, corruptAlt], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    
    const alt = result.current.result?.alternatives.find(a => a.product.id === 'corrupt');
    expect(alt).toBeUndefined(); // Filtered out correctly
  });

  it('should handle many alternatives (Performance/Limit test)', () => {
    const manyAlts = Array.from({ length: 100 }, (_, i) => ({
      ...baseProduct,
      id: `alt-${i}`,
      name: `Caneca Alternativa ${i}`,
      supplier: { id: `supp-${i}`, name: `Supplier ${i}` },
      price: 10 + i,
      stock: 1000 - i,
    }));

    mockUseProducts.mockReturnValue({ data: [baseProduct, ...manyAlts], isLoading: false });

    const start = performance.now();
    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    const end = performance.now();

    expect(result.current.result?.alternatives.length).toBe(100);
    expect(end - start).toBeLessThan(100); // Should be fast
  });

  it('should respect subcategory bonus in similarity', () => {
     // baseSubcategory is 'Cerâmica'
     const altNoSub = { ...baseProduct, id: 'no-sub', name: 'Caneca Branca', subcategory: 'Outro', supplier: {id: 's2', name: 'B'}};
     const altWithSub = { ...baseProduct, id: 'with-sub', name: 'Caneca Branca', subcategory: 'Cerâmica', supplier: {id: 's3', name: 'C'}};

     mockUseProducts.mockReturnValue({ data: [baseProduct, altNoSub, altWithSub], isLoading: false });

     const { result } = renderHook(() => useSupplierComparison(baseProduct as any, { minNameSimilarity: 0.5 }));
     
     const ids = result.current.result?.alternatives.map(a => a.product.id);
     // withSub should definitely be included if minNameSimilarity is borderline
     expect(ids).toContain('with-sub');
  });

  it('should rank extreme price differences correctly', () => {
    const cheapAlt = { ...baseProduct, id: 'cheap', price: 1, supplier: { id: 's2', name: 'B' } }; // 90% cheaper
    const expensiveAlt = { ...baseProduct, id: 'expensive', price: 100, supplier: { id: 's3', name: 'C' } }; // 900% expensive

    mockUseProducts.mockReturnValue({ data: [baseProduct, cheapAlt, expensiveAlt], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    
    const cheap = result.current.result?.alternatives.find(a => a.product.id === 'cheap');
    const expensive = result.current.result?.alternatives.find(a => a.product.id === 'expensive');
    
    expect(cheap?.score).toBeGreaterThan(expensive?.score ?? 0);
    // Expensive score should be very low but not negative/NaN
    expect(expensive?.score).toBeGreaterThanOrEqual(0);
  });

  it('should handle zero stock products in score', () => {
    const noStockAlt = { ...baseProduct, id: 'nostock', stock: 0, supplier: { id: 's2', name: 'B' } };
    
    mockUseProducts.mockReturnValue({ data: [baseProduct, noStockAlt], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    const alt = result.current.result?.alternatives[0];
    
    expect(alt?.score).toBeLessThan(100);
    expect(alt?.isBestStock).toBe(false);
  });
  it('should never produce NaN or negative scores even with extreme inputs', () => {
    const extremeAlt = { 
      ...baseProduct, 
      id: 'extreme', 
      price: Infinity, 
      stock: -100, 
      leadTimeDays: NaN,
      supplier: { id: 's2', name: 'B' }
    };

    mockUseProducts.mockReturnValue({ data: [baseProduct, extremeAlt], isLoading: false });

    const { result } = renderHook(() => useSupplierComparison(baseProduct as any));
    const alt = result.current.result?.alternatives[0];
    
    expect(alt?.score).toBeDefined();
    expect(alt?.score).toBeGreaterThanOrEqual(0);
    expect(alt?.score).toBeLessThanOrEqual(100);
    expect(Number.isNaN(alt?.score)).toBe(false);
  });
});


