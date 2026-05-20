import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the external DB fetch
vi.mock('@/lib/external-db', () => ({
  fetchPromobrindCategories: vi.fn().mockResolvedValue([
    { id: '1', name: 'Canetas' },
    { id: '2', name: 'Cadernos' },
    { id: '3', name: 'Mochilas' },
  ]),
}));

import { useCategories } from '@/hooks/products/useCategories';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useCategories', () => {
  it('fetches and transforms categories', async () => {
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toEqual({
      id: '1',
      name: 'Canetas',
      slug: 'canetas',
    });
  });

  it('generates slugs from category names', async () => {
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![2].slug).toBe('mochilas');
  });
});
