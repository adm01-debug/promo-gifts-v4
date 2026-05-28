import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProductVariantsWithStock } from '../useVariantSupplierSources';
import { invokeExternalDb } from '@/lib/external-db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock do invokeExternalDb
vi.mock('@/lib/external-db', () => ({
  invokeExternalDb: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => 
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useProductVariantsWithStock Integration (Mock)', () => {
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
  });
});
