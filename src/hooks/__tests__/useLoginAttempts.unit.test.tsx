import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLoginAttempts } from "@/hooks/auth/useLoginAttempts";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock implementation that actually returns itself
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
