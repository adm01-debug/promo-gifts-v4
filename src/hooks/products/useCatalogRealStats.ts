/**
 * useCatalogRealStats — Fetches real aggregate counts from the external DB.
 * Uses individual queries (not batch) because batch doesn't support countMode.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';

export interface CatalogRealStats {
  totalVariants: number;
  totalCategories: number;
  totalSuppliers: number;
}

const HIDDEN_CATEGORY_PATTERNS = [
  'matéria',
  'prima',
  'gravações',
  'personalização',
  'suprimentos',
  'insumos',
  'gravação | mochila',
];

function isHiddenCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return HIDDEN_CATEGORY_PATTERNS.some((p) => lower.includes(p));
}

export function useCatalogRealStats() {
  return useQuery<CatalogRealStats>({
    queryKey: ['catalog-real-stats', 'v4'],
    queryFn: async () => {
      // Run 3 parallel queries with countMode: exact
      const [variantsResult, categoriesResult, suppliersResult] = await Promise.all([
        dbInvoke<{ id: string }>({
          table: 'product_variants',
          operation: 'select',
          select: 'id',
          filters: {},
          limit: 1,
          offset: 0,
          countMode: 'exact',
        }),
        dbInvoke<{ id: string; name: string }>({
          table: 'categories',
          operation: 'select',
          select: 'id,name',
          filters: { active: true },
          limit: 1000,
          offset: 0,
          countMode: 'exact',
        }),
        dbInvoke<{ id: string }>({
          table: 'suppliers',
          operation: 'select',
          select: 'id',
          filters: { active: true },
          limit: 1,
          offset: 0,
          countMode: 'exact',
        }),
      ]);

      // Variants: use count from countMode
      const totalVariants = variantsResult.count ?? 0;

      // Categories: filter hidden ones from records
      const visible = categoriesResult.records.filter((c) => !isHiddenCategory(c.name ?? ''));
      const totalCategories = visible.length;

      // Suppliers: use count from countMode
      const totalSuppliers = suppliersResult.count ?? 0;

      return { totalVariants, totalCategories, totalSuppliers };
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
