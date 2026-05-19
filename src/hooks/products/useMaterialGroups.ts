import { useQuery } from "@tanstack/react-query";
import { materialService, type MaterialGroup } from "@/services/materialService";

export interface UseMaterialGroupsReturn {
  groups: MaterialGroup[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  totalGroups: number;
  totalMaterials: number;
  totalProducts: number;
}

export function useMaterialGroups(): UseMaterialGroupsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['material-groups', 'v2'],
    queryFn: () => materialService.getGroups(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  const groups = data?.groups || [];
  
  const totalGroups = groups.length;
  const totalMaterials = groups.reduce((sum, g) => sum + (g.total_materials || 0), 0);
  const totalProducts = groups.reduce((sum, g) => sum + (g.products_using || 0), 0);

  return {
    groups,
    isLoading,
    error: error as Error | null,
    refetch,
    totalGroups,
    totalMaterials,
    totalProducts,
  };
}
