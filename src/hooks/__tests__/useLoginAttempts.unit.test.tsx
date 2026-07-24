import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLoginAttempts } from '@/hooks/auth/useLoginAttempts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock implementation that actually returns itself
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery: any = {
  select: vi.fn().mockImplementation(() => mockQuery),
  order: vi.fn().mockImplementation(() => mockQuery),
  range: vi.fn().mockImplementation(() => mockQuery),
  ilike: vi.fn().mockImplementation(() => mockQuery),
  eq: vi.fn().mockImplementation(() => mockQuery),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQuery),
  },
}));

// useLoginAttempts é admin-guarded (BUG-HEAD-GUARD FIX 2026-06-23):
// enabled = rolesLoaded && isAdmin. Sem este mock a query fica gated e nunca resolve.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ rolesLoaded: true, isAdmin: true }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useLoginAttempts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('fetches login attempts baseline', async () => {
    const mockData = [{ id: '1', email: 'test@example.com', success: true }];
    mockQuery.range.mockResolvedValue({ data: mockData, count: 1, error: null });

    const { result } = renderHook(() => useLoginAttempts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.attempts).toEqual(mockData);
  });
});
