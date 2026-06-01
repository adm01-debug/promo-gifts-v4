import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db/bridge';

export type NoveltyWithDetails = {
  novelty_id: string;
  product_id: string;
  supplier_id: string;
  detected_at: string;
  days_remaining: number;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  product_description: string | null;
  base_price: number;
  category_id: string;
  category_name: string;
  supplier_name: string;
  supplier_product_code: string | null;
  is_active: boolean;
  is_highlighted: boolean;
};

async function fetchNoveltiesWithDetails(options?: {
  limit?: number;
}): Promise<NoveltyWithDetails[]> {
  try {
    const result = await invokeExternalDb<NoveltyWithDetails>({
      table: 'v_novelty_products_detailed',
      operation: 'select',
      limit: options?.limit || 200,
    });
    return result.records;
  } catch (error) {
    console.error('Error fetching novelties with details:', error);
    return [];
  }
}

export function useNoveltiesWithDetails(options?: { limit?: number }) {
  return useQuery({
    queryKey: ['novelties-with-details', options],
    queryFn: () => fetchNoveltiesWithDetails(options),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNoveltyStats() {
  return useQuery({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const novelties = await fetchNoveltiesWithDetails({ limit: 500 });

      const activeNovelties = novelties.length;
      const arrivedToday = novelties.filter((n) => {
        const d = new Date(n.detected_at);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      }).length;

      const arrivedThisWeek = novelties.filter((n) => {
        const d = new Date(n.detected_at);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }).length;

      const supMap = new Map<string, { name: string; count: number }>();
      novelties.forEach((n) => {
        if (n.supplier_id && n.supplier_name) {
          const e = supMap.get(n.supplier_id);
          if (e) e.count++;
          else supMap.set(n.supplier_id, { name: n.supplier_name, count: 1 });
        }
      });

      let topSupplierName = null;
      let topSupplierCount = 0;
      for (const [_, info] of supMap) {
        if (info.count > topSupplierCount) {
          topSupplierCount = info.count;
          topSupplierName = info.name;
        }
      }

      return {
        activeNovelties,
        arrivedToday,
        arrivedThisWeek,
        topSupplierName,
        topSupplierCount,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
