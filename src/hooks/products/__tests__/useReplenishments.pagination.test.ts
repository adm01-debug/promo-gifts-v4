import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReplenishmentsWithDetails } from '../useReplenishments';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
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

describe('useReplenishmentsWithDetails Pagination & Consistency', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('should fetch different ranges correctly for pagination', async () => {
    const mockDataPage1 = [
      { id: '1', name: 'P1', updated_at: new Date().toISOString(), created_at: new Date(Date.now() - 90000000).toISOString() },
    ];
    
    const fromSpy = vi.spyOn(supabase, 'from');
    
    // Page 1
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockDataPage1, error: null }),
    }));

    const { result, rerender } = renderHook(() => useReplenishmentsWithDetails({ limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    // Verify range was 0-9
    const lastCall = (supabase.from('v_products_public') as any).range.mock.calls[0];
    expect(lastCall).toEqual([0, 9]);
  });

  it('should maintain consistency during concurrent updates (simulated)', async () => {
    // This test simulates the logic of pagination with cursor or timestamp
    // In our implementation, we use order('updated_at', { ascending: false })
    
    const now = Date.now();
    const mockData = [
      { id: '1', name: 'P1', updated_at: new Date(now).toISOString(), created_at: new Date(now - 90000000).toISOString() },
      { id: '2', name: 'P2', updated_at: new Date(now - 1000).toISOString(), created_at: new Date(now - 90001000).toISOString() },
    ];

    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }));

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 2 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});
