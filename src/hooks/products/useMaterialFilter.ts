import { useState, useCallback, useMemo } from 'react';
import { useMaterialGroups } from '@/hooks/products/useMaterialGroups';
import { useMaterialsComplete } from '@/hooks/products/useMaterialTypes';
import type { MaterialGroup, MaterialComplete } from '@/services/materialService';

export interface MaterialFilterState {
  selectedGroups: string[]; // slugs dos grupos selecionados
  selectedTypes: string[]; // slugs dos tipos selecionados
  searchTerm: string;
}

export interface UseMaterialFilterReturn {
  // Estado
  filterState: MaterialFilterState;

  // Dados
  groups: MaterialGroup[];
  materials: MaterialComplete[];
  byGroup: Map<string, MaterialComplete[]>;

  // Status
  isLoading: boolean;
  error: Error | null;

  // Ações
  toggleGroup: (groupSlug: string) => void;
  toggleType: (typeSlug: string) => void;
  setSearchTerm: (term: string) => void;
  clearFilters: () => void;
  clearGroupFilters: () => void;
  clearTypeFilters: () => void;

  // Contadores
  activeFiltersCount: number;
  totalGroups: number;
  totalMaterials: number;

  // Materiais filtrados
  filteredMaterials: MaterialComplete[];

  // Helpers
  isGroupSelected: (groupSlug: string) => boolean;
  isTypeSelected: (typeSlug: string) => boolean;
  getTypesForGroup: (groupSlug: string) => MaterialComplete[];
  getSelectedTypesForGroup: (groupSlug: string) => MaterialComplete[];
}

const defaultFilterState: MaterialFilterState = {
  selectedGroups: [],
  selectedTypes: [],
  searchTerm: '',
};

export function useMaterialFilter(): UseMaterialFilterReturn {
  const [filterState, setFilterState] = useState<MaterialFilterState>(defaultFilterState);

  const {
    groups,
    isLoading: groupsLoading,
    error: groupsError,
    totalGroups,
    totalMaterials,
  } = useMaterialGroups();
  const {
    materials,
    isLoading: materialsLoading,
    error: materialsError,
    byGroup,
  } = useMaterialsComplete();

  const isLoading = groupsLoading || materialsLoading;
  const error = groupsError || materialsError;

  // Toggle grupo — selecionar grupo auto-seleciona todos os tipos (#13)
  const toggleGroup = useCallback(
    (groupSlug: string) => {
      setFilterState((prev) => {
        const isSelected = prev.selectedGroups.includes(groupSlug);
        const typesInGroup = byGroup.get(groupSlug)?.map((m) => m.type_slug) ?? [];
        if (isSelected) {
          // Remove grupo e todos os tipos desse grupo
          return {
            ...prev,
            selectedGroups: prev.selectedGroups.filter((g) => g !== groupSlug),
            selectedTypes: prev.selectedTypes.filter((t) => !typesInGroup.includes(t)),
          };
        }
        // Selecionar grupo + todos os tipos que ainda não estão selecionados
        const newTypes = typesInGroup.filter((t) => !prev.selectedTypes.includes(t));
        return {
          ...prev,
          selectedGroups: [...prev.selectedGroups, groupSlug],
          selectedTypes: [...prev.selectedTypes, ...newTypes],
        };
      });
    },
    [byGroup],
  );

  // Toggle tipo
  const toggleType = useCallback((typeSlug: string) => {
    setFilterState((prev) => {
      const isSelected = prev.selectedTypes.includes(typeSlug);
      if (isSelected) {
        return {
          ...prev,
          selectedTypes: prev.selectedTypes.filter((t) => t !== typeSlug),
        };
      }
      return {
        ...prev,
        selectedTypes: [...prev.selectedTypes, typeSlug],
      };
    });
  }, []);

  // Set search term
  const setSearchTerm = useCallback((term: string) => {
    setFilterState((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterState(defaultFilterState);
  }, []);

  // Clear only group filters
  const clearGroupFilters = useCallback(() => {
    setFilterState((prev) => ({ ...prev, selectedGroups: [] }));
  }, []);

  // Clear only type filters
  const clearTypeFilters = useCallback(() => {
    setFilterState((prev) => ({ ...prev, selectedTypes: [] }));
  }, []);

  // Helpers
  const isGroupSelected = useCallback(
    (groupSlug: string) => {
      return filterState.selectedGroups.includes(groupSlug);
    },
    [filterState.selectedGroups],
  );

  const isTypeSelected = useCallback(
    (typeSlug: string) => {
      return filterState.selectedTypes.includes(typeSlug);
    },
    [filterState.selectedTypes],
  );

  const getTypesForGroup = useCallback(
    (groupSlug: string) => {
      return byGroup.get(groupSlug) ?? [];
    },
    [byGroup],
  );

  const getSelectedTypesForGroup = useCallback(
    (groupSlug: string) => {
      const typesInGroup = byGroup.get(groupSlug) ?? [];
      return typesInGroup.filter((t) => filterState.selectedTypes.includes(t.type_slug));
    },
    [byGroup, filterState.selectedTypes],
  );

  // Materiais filtrados
  const filteredMaterials = useMemo(() => {
    let result = materials;

    // Filtrar por busca
    if (filterState.searchTerm) {
      const term = filterState.searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.type_name.toLowerCase().includes(term) || m.group_name.toLowerCase().includes(term),
      );
    }

    // Filtrar por grupos selecionados
    if (filterState.selectedGroups.length > 0) {
      result = result.filter((m) => filterState.selectedGroups.includes(m.group_slug));
    }

    // Filtrar por tipos selecionados
    if (filterState.selectedTypes.length > 0) {
      result = result.filter((m) => filterState.selectedTypes.includes(m.type_slug));
    }

    return result;
  }, [materials, filterState]);

  // Contador de filtros ativos
  const activeFiltersCount = filterState.selectedGroups.length + filterState.selectedTypes.length;

  return {
    filterState,
    groups,
    materials,
    byGroup,
    isLoading,
    error,
    toggleGroup,
    toggleType,
    setSearchTerm,
    clearFilters,
    clearGroupFilters,
    clearTypeFilters,
    activeFiltersCount,
    totalGroups,
    totalMaterials,
    filteredMaterials,
    isGroupSelected,
    isTypeSelected,
    getTypesForGroup,
    getSelectedTypesForGroup,
  };
}
