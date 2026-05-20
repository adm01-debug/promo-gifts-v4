import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// useSupplierComparison expects a Product object, not a string.
// Mock useProducts to avoid external DB calls.
vi.mock('@/hooks/products/useProducts', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
}));

import { useSupplierComparison } from '@/hooks/products/useSupplierComparison';

describe('useSupplierComparison', () => {
  it('should return null data when no product is provided', () => {
    const { result } = renderHook(() => useSupplierComparison(null));
    expect(result.current.data).toBeNull();
  });

  it('should return null data when undefined product is provided', () => {
    const { result } = renderHook(() => useSupplierComparison(undefined));
    expect(result.current.data).toBeNull();
  });
});
