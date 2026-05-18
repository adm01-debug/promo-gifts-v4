import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteItems } from '../useQuoteItems';

describe('useQuoteItems Auto-Expand', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  it('should auto-expand the item when a product is added', () => {
    const { result } = renderHook(() => useQuoteItems());

    const mockProduct = {
      id: 'prod-1',
      name: 'Product Test',
      sku: 'SKU-1',
      price: 10,
      images: [],
      priceUpdatedAt: null,
      priceFreshnessThresholdDays: null,
    } as any;

    act(() => {
      result.current.addProductWithColor(mockProduct, null);
    });

    // Check if item was added
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product_id).toBe('prod-1');

    // Check if the item index (0) is in expandedItems
    expect(result.current.expandedItems.has(0)).toBe(true);
  });

  it('should auto-expand the existing item when it is added again', () => {
    const { result } = renderHook(() => useQuoteItems());

    const mockProduct = {
      id: 'prod-1',
      name: 'Product Test',
      sku: 'SKU-1',
      price: 10,
      images: [],
    } as any;

    // Add first time
    act(() => {
      result.current.addProductWithColor(mockProduct, null);
    });
    
    // Explicitly collapse it
    act(() => {
        result.current.toggleExpanded(0);
    });
    expect(result.current.expandedItems.has(0)).toBe(false);

    // Add again
    act(() => {
      result.current.addProductWithColor(mockProduct, null);
    });

    // Should be expanded again
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.expandedItems.has(0)).toBe(true);
  });
});
