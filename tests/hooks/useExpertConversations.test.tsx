import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, role: 'vendedor', isLoading: false, profile: null }),
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

import { useExpertConversations } from '@/hooks/intelligence/useExpertConversations';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useExpertConversations', () => {
  it('initializes with empty conversations', () => {
    const { result } = renderHook(() => useExpertConversations(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
    expect(result.current.conversations).toEqual([]);
  });
});
