import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// useSupplierComparison expects a Product object, not a string.
// Mock useProducts to avoid external DB calls.
vi.mock('@/hooks/products/useProducts', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
}));

import { useSupplierComparison } from '@/hooks/products/useSupplierComparison';

describe('useSupplierComparison', () => {
  it('should return null when no product is provided', () => {
    const { result } = renderHook(() => useSupplierComparison(null));
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should return null when undefined product is provided', () => {
    const { result } = renderHook(() => useSupplierComparison(undefined));
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
