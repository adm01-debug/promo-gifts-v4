import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCatalogPrefetch } from './useCatalogPrefetch';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

vi.mock('./useProductsLightweight', () => ({
  CATALOG_BATCH_PAGES: 4,
  CATALOG_PAGE_SIZE: 500,
  PRODUCT_SELECT_LIGHTWEIGHT: '',
  mapLightweightToProduct: vi.fn(),
}));

describe('useCatalogPrefetch', () => {
  const mockQueryClient = {
    prefetchInfiniteQuery: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as any);
  });

  it('does not prefetch if not authenticated', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, isLoading: false } as any);
    renderHook(() => useCatalogPrefetch());
    expect(mockQueryClient.prefetchInfiniteQuery).not.toHaveBeenCalled();
  });

  it('prefetches catalog after delay when authenticated', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, isLoading: false } as any);
    renderHook(() => useCatalogPrefetch());

    await waitFor(
      () => {
        expect(mockQueryClient.prefetchInfiniteQuery).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });
});
