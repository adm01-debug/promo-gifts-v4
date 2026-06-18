/**
 * useProductsBySize / useAvailableSizes — SF-E
 *
 * O catálogo leve do Super Filtro não carrega variações, então a filtragem por
 * tamanho não pode acontecer client-side. Estes hooks resolvem isso via
 * `product_variants` (mesma fonte usada por useProductsByColor):
 *
 *  - useProductsBySize: IDs de produtos que têm variação ativa nos tamanhos
 *    selecionados (Set para lookup O(1) no pipeline de filtros).
 *  - useAvailableSizes: tamanhos distintos disponíveis no catálogo (para popular
 *    a seção "Tamanhos" do painel, já que os produtos carregados não trazem
 *    variações).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbInvoke } from '@/lib/db/postgrest';

export interface UseProductsBySizeReturn {
  /** Set de product IDs com variação ativa em algum dos tamanhos selecionados. */
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
  error: unknown;
}

export function useProductsBySize(sizes: string[] = []): UseProductsBySizeReturn {
  const hasFilter = sizes.length > 0;
  // Chave estável: a ordem da seleção não deve invalidar o cache.
  const sizeKey = useMemo(() => [...sizes].sort(), [sizes]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products-by-size', sizeKey],
    queryFn: async () => {
      const result = await dbInvoke<{ product_id: string }>({
        table: 'product_variants',
        operation: 'select',
        select: 'product_id',
        filters: { is_active: true, size_code: sizeKey },
        limit: 10000,
      });
      const set = new Set<string>();
      for (const r of result.records) if (r.product_id) set.add(r.product_id);
      return set;
    },
    enabled: hasFilter,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const productIds = useMemo(() => data ?? new Set<string>(), [data]);
  return {
    productIds,
    hasFilter,
    isLoading: hasFilter ? isLoading : false,
    error: hasFilter ? error : null,
  };
}

export interface UseAvailableSizesReturn {
  sizes: string[];
  isLoading: boolean;
}

export function useAvailableSizes(): UseAvailableSizesReturn {
  const { data, isLoading } = useQuery({
    queryKey: ['available-sizes', 'v1'],
    queryFn: async () => {
      // size_code > '' → exclui NULL e vazios (apenas variações com tamanho real).
      const result = await dbInvoke<{ size_code: string | null }>({
        table: 'product_variants',
        operation: 'select',
        select: 'size_code',
        filters: { is_active: true, size_code: { op: 'gt', value: '' } },
        limit: 20000,
      });
      const set = new Set<string>();
      for (const r of result.records) {
        const code = r.size_code?.trim();
        if (code) set.add(code);
      }
      return [...set];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return { sizes: data ?? [], isLoading };
}
