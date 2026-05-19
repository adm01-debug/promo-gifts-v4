/**
 * Hook para buscar nomes dos fornecedores a partir de IDs.
 * Consulta a tabela 'suppliers' no banco externo.
 */
import { useQuery } from '@tanstack/react-query';
import { invokeBatchBridge, type BatchQuery } from '@/lib/external-db';

/**
 * Busca nomes dos fornecedores para um conjunto de IDs.
 * Retorna um Map<supplier_id, supplier_name>.
 * Uses batch bridge to fetch all suppliers in a single request.
 */
export function useSupplierNames(supplierIds: string[]) {
  const uniqueIds = [...new Set(supplierIds.filter(Boolean))];

  return useQuery({
    queryKey: ['supplier-names', uniqueIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, string>> => {
      if (uniqueIds.length === 0) return new Map();

      try {
        // Batch all supplier lookups in one bridge call
        const queries: BatchQuery[] = uniqueIds.map(id => ({
          table: 'suppliers',
          select: 'id,name',
          filters: { id },
          limit: 1,
          cacheKey: `supplier-${id}`,
        }));

        const results = await invokeBatchBridge(queries);
        const map = new Map<string, string>();

        results.forEach((result, idx) => {
          if (result.success && result.data?.records?.length) {
            const record = result.data.records[0] as { id: string; name: string };
            map.set(record.id, record.name);
          } else {
            map.set(uniqueIds[idx], `Fornecedor ${uniqueIds[idx].slice(0, 6)}`);
          }
        });

        return map;
      } catch {
        // Fallback: use truncated IDs as names
        return new Map(uniqueIds.map(id => [id, `Fornecedor ${id.slice(0, 6)}`]));
      }
    },
    enabled: uniqueIds.length > 0,
    staleTime: 60 * 60 * 1000, // 1h cache — supplier names rarely change
  });
}
