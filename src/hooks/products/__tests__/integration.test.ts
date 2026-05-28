import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProductVariantsWithStock } from '../useVariantSupplierSources';
import { invokeExternalDb } from '@/lib/external-db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock do invokeExternalDb
vi.mock('@/lib/external-db', () => ({
  invokeExternalDb: vi.fn(),
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => 
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useProductVariantsWithStock Integration (Mock)', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });
  it('deve formatar corretamente os dados vindo do JOIN com variant_supplier_sources', async () => {
    const mockDbResult = {
      records: [
        {
          id: 'v1',
          product_id: 'p1',
          sku: 'SKU-01',
          color_name: 'Azul',
          variant_supplier_sources: [
            {
              next_date_1: '2026-06-10',
              next_quantity_1: 50,
              next_date_2: '2026-07-15',
              next_quantity_2: 100,
              next_date_3: null,
              next_quantity_3: 0,
            }
          ]
        }
      ]
    };

    (invokeExternalDb as any).mockResolvedValue(mockDbResult);

    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const variant = result.current.data![0];
    
    // Verifica mapeamento de compatibilidade
    expect(variant.next_entry_date).toBe('2026-06-10');
    expect(variant.next_entry_quantity).toBe(50);
    
    // Verifica mapeamento das múltiplas datas
    expect(variant.next_date_1).toBe('2026-06-10');
    expect(variant.next_date_2).toBe('2026-07-15');
    expect(variant.next_date_3).toBe(null);

    expect(variant.next_quantity_1).toBe(50);
    expect(variant.next_quantity_2).toBe(100);
    expect(variant.next_quantity_3).toBe(0); // No mock era 0, mas o processStockEntries deve ignorar se for <= 0
  });

  it('deve lidar com variant_supplier_sources vazio sem quebrar', async () => {
    const mockDbResult = {
      records: [
        {
          id: 'v2',
          product_id: 'p1',
          sku: 'SKU-02',
          variant_supplier_sources: []
        }
      ]
    };

    (invokeExternalDb as any).mockResolvedValue(mockDbResult);
    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    const variant = result.current.data![0];
    expect(variant.next_date_1).toBeUndefined();
    expect(variant.next_entry_date).toBeNull();
  });
});
