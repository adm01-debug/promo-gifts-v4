/**
 * Hook para buscar nomes dos fornecedores a partir de IDs.
 * Consulta a tabela 'suppliers' no banco externo.
 */
import { useMemo } from 'react';
import { dbInvoke, type InvokeOptions } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';

export function useSupplierNames(supplierIds: string[]) {
  const uniqueIds = useMemo(() => [...new Set(supplierIds.filter(Boolean))], [supplierIds]);

  return useQuery({
    queryKey: ['supplier-names', uniqueIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, string>> => {
      if (uniqueIds.length === 0) return new Map();
      try {
        const queries: InvokeOptions[] = uniqueIds.map((id) => ({
          table: 'suppliers',
          operation: 'select' as const,
          select: 'id,name',
          filters: { id },
          limit: 1,
        }));

        const results = await Promise.all(queries.map((q) => dbInvoke(q)));
        const map = new Map<string, string>();
        results.forEach((result, idx) => {
          // FIX-CATALOG-01: dbInvoke returns InvokeResult { records, count }, not BatchResult { success, data }
          if (result.records?.length) {
            const record = result.records[0] as { id: string; name: string };
            map.set(record.id, record.name);
          } else {
            map.set(uniqueIds[idx], `Fornecedor ${uniqueIds[idx].slice(0, 6)}`);
          }
        });
        return map;
      } catch {
        return new Map(uniqueIds.map((id) => [id, `Fornecedor ${id.slice(0, 6)}`]));
      }
    },
    enabled: uniqueIds.length > 0,
    staleTime: 60 * 60 * 1000,
  });
}
