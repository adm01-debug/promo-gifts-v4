import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock auth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, role: 'vendedor', isLoading: false, profile: null }),
}));

// Mock supabase with chained query builder
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    }),
  },
}));

import { useSellerCarts } from '@/hooks/products/useSellerCarts';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useSellerCarts', () => {
  it('initializes with empty carts', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.carts).toBeDefined();
    });
    expect(Array.isArray(result.current.carts)).toBe(true);
  });

  it('exposes mutation methods', () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper: createWrapper() });
    expect(result.current.createCart).toBeDefined();
    expect(result.current.deleteCart).toBeDefined();
    expect(result.current.addItem).toBeDefined();
    expect(typeof result.current.createCart.mutateAsync).toBe('function');
  });
});
