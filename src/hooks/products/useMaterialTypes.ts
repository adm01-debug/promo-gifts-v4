import { useQuery } from '@tanstack/react-query';
import {
  materialService,
  type MaterialType,
  type MaterialComplete,
} from '@/services/materialService';

export interface UseMaterialTypesReturn {
  types: MaterialType[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  count: number;
}

export function useMaterialTypes(): UseMaterialTypesReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['material-types', 'v2'],
    queryFn: () => materialService.getTypes(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    types: data?.types ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    count: data?.count || 0,
  };
}

export interface UseMaterialTypesByGroupReturn {
  types: MaterialType[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  count: number;
  groupSlug: string;
}

export function useMaterialTypesByGroup(groupSlug: string): UseMaterialTypesByGroupReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['material-types-by-group', groupSlug, 'v2'],
    queryFn: () => materialService.getTypesByGroupSlug(groupSlug),
    enabled: !!groupSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    types: data?.types ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    count: data?.count || 0,
    groupSlug,
  };
}

export interface UseMaterialsCompleteReturn {
  materials: MaterialComplete[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  count: number;
  // Dados organizados por grupo
  byGroup: Map<string, MaterialComplete[]>;
}

export function useMaterialsComplete(): UseMaterialsCompleteReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['materials-complete', 'v2'],
    queryFn: () => materialService.getComplete(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const materials = data?.materials ?? [];

  // Organizar por grupo
  const byGroup = new Map<string, MaterialComplete[]>();
  materials.forEach((m) => {
    const existing = byGroup.get(m.group_slug) ?? [];
    existing.push(m);
    byGroup.set(m.group_slug, existing);
  });

  return {
    materials,
    isLoading,
    error: error as Error | null,
    refetch,
    count: data?.count || 0,
    byGroup,
  };
}

export interface UseMaterialSearchReturn {
  results: MaterialComplete[];
  isLoading: boolean;
  error: Error | null;
  search: (term: string) => void;
  searchTerm: string;
}

export function useMaterialSearch() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['material-search'],
    queryFn: () => Promise.resolve({ types: [], count: 0, search: '' }),
    enabled: false,
  });

  return {
    results: data?.types ?? [],
    isLoading,
    error: error as Error | null,
    count: data?.count || 0,
  };
}
