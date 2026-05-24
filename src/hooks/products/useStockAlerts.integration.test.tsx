import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStockAlerts } from './useStockAlerts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as bridge from '@/lib/external-db/bridge';

// Mock the bridge to inspect its calls
vi.mock('@/lib/external-db/bridge', async () => {
  const actual = await vi.importActual('@/lib/external-db/bridge');
  return {
    ...actual,
    invokeExternalDb: vi.fn(),
  };
});

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

describe('useStockAlerts integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should NOT include supplier_name or image_url in the select query', async () => {
    const mockRecords = [
      {
        id: '1',
        name: 'Test Product',
        sku: 'SKU123',
        stock_quantity: 5,
        min_quantity: 10,
        brand: 'Brand X',
        primary_image_url: 'http://img.com/1.jpg',
        images: ['http://img.com/1.jpg'],
      },
    ];

    const invokeExternalDbMock = vi.mocked(bridge.invokeExternalDb);
    invokeExternalDbMock.mockResolvedValue({
      records: mockRecords,
      count: 1,
    });

    const { result } = renderHook(() => useStockAlerts(50, 10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArgs = invokeExternalDbMock.mock.calls[0][0] as { select: string };
    const selectStr = callArgs.select;

    const fields = selectStr.split(',').map((f: string) => f.trim());
    expect(fields).not.toContain('supplier_name');
    expect(fields).not.toContain('image_url');

    // Verify it contains the required fields
    expect(selectStr).toContain('brand');
    expect(selectStr).toContain('primary_image_url');
  });

  it('should map brand to supplier field correctly', async () => {
    const invokeExternalDbMock = vi.mocked(bridge.invokeExternalDb);
    invokeExternalDbMock.mockResolvedValue({
      records: [
        {
          id: 'p1',
          name: 'Mapped Product',
          sku: 'SKU-M',
          stock_quantity: 2,
          brand: 'External Supplier',
        },
      ],
      count: 1,
    });

    const { result } = renderHook(() => useStockAlerts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].supplier).toBe('External Supplier');
  });
});
