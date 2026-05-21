import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, role: 'vendedor', isLoading: false, profile: null }),
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

import { useComparison } from '@/hooks/comparison/useComparison';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useComparison', () => {
  it('should initialize with empty compareIds', () => {
    const { result } = renderHook(() => useComparison(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
    expect(result.current.compareIds).toEqual([]);
  });

  it('should add items to comparison', () => {
    const { result } = renderHook(() => useComparison(), { wrapper: createWrapper() });
    act(() => { result.current.toggleCompare('product-1'); });
    expect(result.current.compareIds).toContain('product-1');
  });
});
