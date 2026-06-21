import { useState, useMemo, useCallback } from 'react';
import { useRamoAtividadeGroups, useSegmentosCompletos } from '@/hooks/crm';
import type {
  RamoAtividadeGroup,
  SegmentoComplete,
  RamoAtividadeFilterState,
} from '@/types/ramo-atividade';

export type { RamoAtividadeFilterState };

export interface UseRamoAtividadeFilterReturn {
  groups: RamoAtividadeGroup[];
  totalGroups: number;
  totalSegmentos: number;
  segmentos: SegmentoComplete[];
  byRamo: Map<string, SegmentoComplete[]>;
  filterState: RamoAtividadeFilterState;
  isLoading: boolean;
  error: Error | null;
  toggleRamo: (ramoSlug: string) => void;
  toggleSegmento: (segmentoSlug: string) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
  selectedCount: number;
  getSegmentosForRamo: (ramoSlug: string) => SegmentoComplete[];
  getSelectedSegmentosForRamo: (ramoSlug: string) => SegmentoComplete[];
  isRamoSelected: (ramoSlug: string) => boolean;
  isSegmentoSelected: (segmentoSlug: string) => boolean;
  isRamoPartiallySelected: (ramoSlug: string) => boolean;
}

export function useRamoAtividadeFilter(): UseRamoAtividadeFilterReturn {
  const {
    data: groupsData,
    isLoading: groupsLoading,
    error: groupsError,
  } = useRamoAtividadeGroups();

  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const totalGroups = groupsData?.totalGroups ?? 0;
  const totalSegmentos = groupsData?.totalSegmentos ?? 0;
  const {
    data: segmentosData,
    isLoading: segmentosLoading,
    error: segmentosError,
  } = useSegmentosCompletos();

  const segmentos = useMemo(() => segmentosData?.segmentos ?? [], [segmentosData?.segmentos]);
  const byRamo = useMemo(
    () => segmentosData?.byRamo || new Map<string, SegmentoComplete[]>(),
    [segmentosData?.byRamo],
  );

  const [filterState, setFilterState] = useState<RamoAtividadeFilterState>({
    selectedRamos: [],
    selectedSegmentos: [],
    searchTerm: '',
  });

  const isLoading = groupsLoading || segmentosLoading;
  const error = groupsError || segmentosError;

  // Toggle ramo
  const toggleRamo = useCallback(
    (ramoSlug: string) => {
      setFilterState((prev) => {
        const isSelected = prev.selectedRamos.includes(ramoSlug);
        if (isSelected) {
          // Remove ramo e todos os segmentos desse ramo
          const segmentosNoRamo =
            byRamo.get(ramoSlug)?.map((s: SegmentoComplete) => s.segmento_slug) ?? [];
          return {
            ...prev,
            selectedRamos: prev.selectedRamos.filter((r) => r !== ramoSlug),
            selectedSegmentos: prev.selectedSegmentos.filter(
              (s: string) => !segmentosNoRamo.includes(s),
            ),
          };
        }
        // Add ramo + all its segmentos
        const segmentosDoRamo =
          byRamo.get(ramoSlug)?.map((s: SegmentoComplete) => s.segmento_slug) ?? [];
        return {
          ...prev,
          selectedRamos: [...prev.selectedRamos, ramoSlug],
          selectedSegmentos: [...new Set([...prev.selectedSegmentos, ...segmentosDoRamo])],
        };
      });
    },
    [byRamo],
  );

  // Toggle segmento
  const toggleSegmento = useCallback((segmentoSlug: string) => {
    setFilterState((prev) => {
      const isSelected = prev.selectedSegmentos.includes(segmentoSlug);
      if (isSelected) {
        return {
          ...prev,
          selectedSegmentos: prev.selectedSegmentos.filter((s: string) => s !== segmentoSlug),
        };
      }
      return {
        ...prev,
        selectedSegmentos: [...prev.selectedSegmentos, segmentoSlug],
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setFilterState({ selectedRamos: [], selectedSegmentos: [], searchTerm: '' });
  }, []);

  const hasActiveFilters =
    filterState.selectedRamos.length > 0 || filterState.selectedSegmentos.length > 0;
  const selectedCount = filterState.selectedRamos.length + filterState.selectedSegmentos.length;

  const selectedRamosSet = useMemo(
    () => new Set(filterState.selectedRamos),
    [filterState.selectedRamos],
  );
  const selectedSegmentosSet = useMemo(
    () => new Set(filterState.selectedSegmentos),
    [filterState.selectedSegmentos],
  );

  const getSegmentosForRamo = useCallback(
    (ramoSlug: string) => {
      return byRamo.get(ramoSlug) || [];
    },
    [byRamo],
  );

  const getSelectedSegmentosForRamo = useCallback(
    (ramoSlug: string) => {
      const segmentosNoRamo = byRamo.get(ramoSlug) || [];
      return segmentosNoRamo.filter((s: SegmentoComplete) =>
        selectedSegmentosSet.has(s.segmento_slug),
      );
    },
    [byRamo, selectedSegmentosSet],
  );

  // Segmentos filtrados
  const filteredSegmentos = useMemo(() => {
    if (selectedRamosSet.size === 0) return segmentos;
    return segmentos.filter((s) => selectedRamosSet.has(s.ramo_slug));
  }, [segmentos, selectedRamosSet]);

  const isRamoSelected = useCallback(
    (ramoSlug: string) => selectedRamosSet.has(ramoSlug),
    [selectedRamosSet],
  );

  const isSegmentoSelected = useCallback(
    (segmentoSlug: string) => selectedSegmentosSet.has(segmentoSlug),
    [selectedSegmentosSet],
  );

  const isRamoPartiallySelected = useCallback(
    (ramoSlug: string) => {
      const segmentosDoRamo = getSegmentosForRamo(ramoSlug);
      if (segmentosDoRamo.length === 0) return false;
      const ramoSelectedCount = segmentosDoRamo.filter((s) =>
        selectedSegmentosSet.has(s.segmento_slug),
      ).length;
      return ramoSelectedCount > 0 && ramoSelectedCount < segmentosDoRamo.length;
    },
    [getSegmentosForRamo, selectedSegmentosSet],
  );

  return {
    groups,
    totalGroups,
    totalSegmentos,
    segmentos: filteredSegmentos,
    byRamo,
    filterState,
    isLoading,
    error,
    toggleRamo,
    toggleSegmento,
    clearAll,
    hasActiveFilters,
    selectedCount,
    getSegmentosForRamo,
    getSelectedSegmentosForRamo,
    isRamoSelected,
    isSegmentoSelected,
    isRamoPartiallySelected,
  };
}
