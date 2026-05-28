import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSupplierComparison } from '@/hooks/products/useSupplierComparison';
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
});

