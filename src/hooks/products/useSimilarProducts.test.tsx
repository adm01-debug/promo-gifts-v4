/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSimilarProducts } from './useSimilarProducts';
import { dbInvoke } from '@/lib/db/postgrest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock do dbInvoke
vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockProduct = {
  id: 'prod-123',
  name: 'Produto Original',
  supplier_id: 'supp-456',
  category_id: 'cat-789',
  supplier: { id: 'supp-456' },
} as any;

describe('useSimilarProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar lista vazia se o produto for nulo', () => {
    const { result } = renderHook(() => useSimilarProducts(null), {
      wrapper: createWrapper(),
    });
    expect(result.current.data).toBeUndefined();
    expect(dbInvoke).not.toHaveBeenCalled();
  });

  it('estratégia 1: deve retornar produtos da tabela product_relationships', async () => {
    (dbInvoke as any)
      .mockResolvedValueOnce({
        records: [{ related_product_id: 'rel-1' }, { related_product_id: 'rel-2' }],
      })
      .mockResolvedValueOnce({
        records: [
          {
            id: 'rel-1',
            name: 'Similar 1',
            sale_price: 10,
            primary_image_url: 'img1.jpg',
            brand: 'Marca A',
          },
          {
            id: 'rel-2',
            name: 'Similar 2',
            sale_price: 20,
            primary_image_url: 'img2.jpg',
            brand: 'Marca B',
          },
        ],
      });

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Similar 1');
    expect(dbInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'product_relationships' }),
    );
  });

  it('estratégia 2: deve usar product_group_members se relationships falhar ou for vazio', async () => {
    // 1. Relationships vazio
    (dbInvoke as any)
      .mockResolvedValueOnce({ records: [] })
      // 2. Busca grupo do produto
      .mockResolvedValueOnce({ records: [{ product_group_id: 'group-99' }] })
      // 3. Busca membros do grupo
      .mockResolvedValueOnce({ records: [{ product_id: 'prod-123' }, { product_id: 'sibling-1' }] })
      // 4. Busca dados do sibling
      .mockResolvedValueOnce({
        records: [
          {
            id: 'sibling-1',
            name: 'Irmão de Grupo',
            sale_price: 15,
            primary_image_url: 'img3.jpg',
          },
        ],
      });

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Irmão de Grupo');
  });

  it('estratégia 3: deve usar fallback por fornecedor se outras falharem', async () => {
    // 1. Relationships erro
    (dbInvoke as any)
      .mockRejectedValueOnce(new Error('DB Error'))
      // 2. Group erro
      .mockRejectedValueOnce(new Error('DB Error'))
      // 3. Fallback query
      .mockResolvedValueOnce({
        records: [
          {
            id: 'fall-1',
            name: 'Fallback Item',
            sale_price: 50,
            primary_image_url: 'img4.jpg',
            supplier_id: 'supp-456',
          },
        ],
      });

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Fallback Item');
  });

  it('deve filtrar produtos com preço zero ou inválido', async () => {
    (dbInvoke as any)
      .mockResolvedValueOnce({ records: [{ related_product_id: 'rel-1' }] })
      .mockResolvedValueOnce({
        records: [{ id: 'rel-1', name: 'Grátis', sale_price: 0, primary_image_url: 'img.jpg' }],
      });

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve aplicar fallback de imagem caso primary_image_url seja nulo', async () => {
    (dbInvoke as any)
      .mockResolvedValueOnce({ records: [{ related_product_id: 'rel-1' }] })
      .mockResolvedValueOnce({
        records: [{ id: 'rel-1', name: 'Sem Foto', sale_price: 10, primary_image_url: null }],
      });

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].image_url).toBe('/placeholder.svg');
  });

  it('deve evitar loops infinitos ou duplicatas de IDs no grupo', async () => {
    (dbInvoke as any)
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [{ product_group_id: 'g1' }, { product_group_id: 'g1' }] })
      .mockResolvedValueOnce({ records: [{ product_id: 'prod-123' }, { product_id: 'prod-123' }] })
      .mockResolvedValueOnce({ records: [] }); // fetchProductsByIds recebe []

    const { result } = renderHook(() => useSimilarProducts(mockProduct), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Se o grupo só tem o próprio produto, cai no fallback final
    expect(dbInvoke).toHaveBeenCalledTimes(4); // rel, group, members, final fallback
  });
});
