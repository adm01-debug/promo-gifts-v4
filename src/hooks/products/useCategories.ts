import { useQuery } from '@tanstack/react-query';
import { fetchPromobrindCategories } from '@/lib/external-db';

// Interface para categorias extraídas da tabela products
export interface Category {
  id: string | number;
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
}

/**
 * Hook para buscar categorias únicas dos produtos Promobrind
 */
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['promobrind-categories'],
    queryFn: async () => {
      const categories = await fetchPromobrindCategories();

      return categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, '-'),
      }));
    },
    staleTime: 30 * 60 * 1000, // 30 min (dados estáveis)
  });
}
