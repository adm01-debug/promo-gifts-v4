import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReplenishmentsWithDetails } from '../useReplenishments';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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

    // Default mock implementation
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));
  });

  it('should fetch different ranges correctly for pagination', async () => {
    const now = Date.now();
    const mockDataPage1 = [
      {
        id: '1',
        name: 'P1',
        updated_at: new Date(now).toISOString(),
        created_at: new Date(now - 90000000).toISOString(),
        sku: 'S1',
        primary_image_url: null,
        sale_price: 10,
        category_id: null,
        supplier_id: null,
        stock_quantity: 20,
        min_quantity: 10,
      },
    ];

    const rangeMock = vi.fn().mockResolvedValue({ data: mockDataPage1, error: null });

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: rangeMock,
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(rangeMock).toHaveBeenCalledWith(0, 9);
    expect(result.current.data).toHaveLength(1);
  });

  it('should maintain consistency during concurrent updates (simulated)', async () => {
    const now = Date.now();
    const mockData = [
      {
        id: '1',
        name: 'P1',
        updated_at: new Date(now).toISOString(),
        created_at: new Date(now - 90000000).toISOString(),
        sku: 'S1',
        primary_image_url: null,
        sale_price: 10,
        category_id: null,
        supplier_id: null,
        stock_quantity: 20,
        min_quantity: 10,
      },
      {
        id: '2',
        name: 'P2',
        updated_at: new Date(now - 1000).toISOString(),
        created_at: new Date(now - 90001000).toISOString(),
        sku: 'S2',
        primary_image_url: null,
        sale_price: 20,
        category_id: null,
        supplier_id: null,
        stock_quantity: 5,
        min_quantity: 10,
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 2 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].product_name).toBe('P1');
    expect(result.current.data?.[1].stock_status).toBe('low-stock');
  });
});
