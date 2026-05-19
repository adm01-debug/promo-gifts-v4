import { useState, useCallback, useMemo } from "react";
import { useRamosAtividadeGroups } from "./useRamoAtividade";
import { useSegmentosCompletos } from "./useRamoAtividadeFilho";
import type { RamoAtividadeGroup, SegmentoComplete, RamoAtividadeFilterState } from "@/types/ramo-atividade";

export interface UseRamoAtividadeFilterReturn {
  // Estado
  filterState: RamoAtividadeFilterState;
  
  // Dados
  groups: RamoAtividadeGroup[];
  segmentos: SegmentoComplete[];
  byRamo: Map<string, SegmentoComplete[]>;
  
  // Status
  isLoading: boolean;
  error: Error | null;
  
  // Ações
  toggleRamo: (ramoSlug: string) => void;
  toggleSegmento: (segmentoSlug: string) => void;
  setSearchTerm: (term: string) => void;
  clearFilters: () => void;
  clearRamoFilters: () => void;
  clearSegmentoFilters: () => void;
  
  // Contadores
  activeFiltersCount: number;
  totalGroups: number;
  totalSegmentos: number;
  
  // Segmentos filtrados
  filteredSegmentos: SegmentoComplete[];
  
  // Helpers
  isRamoSelected: (ramoSlug: string) => boolean;
  isSegmentoSelected: (segmentoSlug: string) => boolean;
  getSegmentosForRamo: (ramoSlug: string) => SegmentoComplete[];
  getSelectedSegmentosForRamo: (ramoSlug: string) => SegmentoComplete[];
}

const defaultFilterState: RamoAtividadeFilterState = {
  selectedRamos: [],
  selectedSegmentos: [],
  searchTerm: "",
};

export function useRamoAtividadeFilter(): UseRamoAtividadeFilterReturn {
  const [filterState, setFilterState] = useState<RamoAtividadeFilterState>(defaultFilterState);
  
  const { data: groupsData, isLoading: groupsLoading, error: groupsError } = useRamosAtividadeGroups();
  const { data: segmentosData, isLoading: segmentosLoading, error: segmentosError } = useSegmentosCompletos();

  const groups = groupsData?.groups || [];
  const segmentos = segmentosData?.segmentos || [];
  const byRamo = segmentosData?.byRamo || new Map();
  const totalGroups = groupsData?.totalGroups || 0;
  const totalSegmentos = groupsData?.totalSegmentos || 0;

  const isLoading = groupsLoading || segmentosLoading;
  const error = groupsError || segmentosError;

  // Toggle ramo
  const toggleRamo = useCallback((ramoSlug: string) => {
    setFilterState(prev => {
      const isSelected = prev.selectedRamos.includes(ramoSlug);
      if (isSelected) {
        // Remove ramo e todos os segmentos desse ramo
        const segmentosNoRamo = byRamo.get(ramoSlug)?.map(s => s.segmento_slug) || [];
        return {
          ...prev,
          selectedRamos: prev.selectedRamos.filter(r => r !== ramoSlug),
          selectedSegmentos: prev.selectedSegmentos.filter(s => !segmentosNoRamo.includes(s)),
        };
      }
      return {
        ...prev,
        selectedRamos: [...prev.selectedRamos, ramoSlug],
      };
    });
  }, [byRamo]);

  // Toggle segmento
  const toggleSegmento = useCallback((segmentoSlug: string) => {
    setFilterState(prev => {
      const isSelected = prev.selectedSegmentos.includes(segmentoSlug);
      if (isSelected) {
        return {
          ...prev,
          selectedSegmentos: prev.selectedSegmentos.filter(s => s !== segmentoSlug),
        };
      }
      return {
        ...prev,
        selectedSegmentos: [...prev.selectedSegmentos, segmentoSlug],
      };
    });
  }, []);

  // Set search term
  const setSearchTerm = useCallback((term: string) => {
    setFilterState(prev => ({ ...prev, searchTerm: term }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterState(defaultFilterState);
  }, []);

  // Clear only ramo filters
  const clearRamoFilters = useCallback(() => {
    setFilterState(prev => ({ ...prev, selectedRamos: [] }));
  }, []);

  // Clear only segmento filters
  const clearSegmentoFilters = useCallback(() => {
    setFilterState(prev => ({ ...prev, selectedSegmentos: [] }));
  }, []);

  // Helpers
  const isRamoSelected = useCallback((ramoSlug: string) => {
    return filterState.selectedRamos.includes(ramoSlug);
  }, [filterState.selectedRamos]);

  const isSegmentoSelected = useCallback((segmentoSlug: string) => {
    return filterState.selectedSegmentos.includes(segmentoSlug);
  }, [filterState.selectedSegmentos]);

  const getSegmentosForRamo = useCallback((ramoSlug: string) => {
    return byRamo.get(ramoSlug) || [];
  }, [byRamo]);

  const getSelectedSegmentosForRamo = useCallback((ramoSlug: string) => {
    const segmentosNoRamo = byRamo.get(ramoSlug) || [];
    return segmentosNoRamo.filter(s => filterState.selectedSegmentos.includes(s.segmento_slug));
  }, [byRamo, filterState.selectedSegmentos]);

  // Segmentos filtrados
  const filteredSegmentos = useMemo(() => {
    let result = segmentos;
    
    // Filtrar por busca
    if (filterState.searchTerm) {
      const term = filterState.searchTerm.toLowerCase();
      result = result.filter(s => 
        s.segmento_name.toLowerCase().includes(term) ||
        s.ramo_name.toLowerCase().includes(term)
      );
    }
    
    // Filtrar por ramos selecionados
    if (filterState.selectedRamos.length > 0) {
      result = result.filter(s => filterState.selectedRamos.includes(s.ramo_slug));
    }
    
    // Filtrar por segmentos selecionados
    if (filterState.selectedSegmentos.length > 0) {
      result = result.filter(s => filterState.selectedSegmentos.includes(s.segmento_slug));
    }
    
    return result;
  }, [segmentos, filterState]);

  // Contador de filtros ativos
  const activeFiltersCount = filterState.selectedRamos.length + filterState.selectedSegmentos.length;

  return {
    filterState,
    groups,
    segmentos,
    byRamo,
    isLoading,
    error,
    toggleRamo,
    toggleSegmento,
    setSearchTerm,
    clearFilters,
    clearRamoFilters,
    clearSegmentoFilters,
    activeFiltersCount,
    totalGroups,
    totalSegmentos,
    filteredSegmentos,
    isRamoSelected,
    isSegmentoSelected,
    getSegmentosForRamo,
    getSelectedSegmentosForRamo,
  };
}
