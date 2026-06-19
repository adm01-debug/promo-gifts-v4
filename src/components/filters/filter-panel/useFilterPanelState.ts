import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/common';
import {
  SORT_OPTIONS,
  useAdvancedFilters,
  useCategoryIcons,
  useMaterialFilter,
  useSuppliers,
} from '@/hooks/products';
import { useRamoAtividadeFilter } from '@/hooks/crm';
import { usePublicoAlvoOptions } from '@/hooks/products/usePublicoAlvoOptions';
import { useAvailableSizes } from '@/hooks/products/useProductsBySize';
import type { FilterState, FilterPanelProps } from './types';

export function useFilterPanelState(
  filters: FilterState,
  onFilterChange: FilterPanelProps['onFilterChange'],
  products: FilterPanelProps['products'] = [],
) {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [ramoSearch, setRamoSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [techniqueSearch, setTechniqueSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [publicoSearch, setPublicoSearch] = useState('');
  const [endoSearch, setEndoSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 500);

  // BUG-19 FIX: stale closure — refs para capturar sempre os valores mais recentes
  // de filters e onFilterChange dentro do effect que só roda quando debouncedSearch muda.
  // Sem esse padrão, o effect fechava sobre versões antigas, sobrescrevendo filtros
  // alterados durante os 500ms de debounce (ex: cor selecionada era apagada).
  const filtersRef = useRef(filters);
  const onFilterChangeRef = useRef(onFilterChange);
  useEffect(() => {
    filtersRef.current = filters;
  });
  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  });

  useEffect(() => {
    if (debouncedSearch !== filtersRef.current.search) {
      onFilterChangeRef.current({ ...filtersRef.current, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  // BUG-SF-07 FIX: sync de localSearch para qualquer mudança externa de filters.search
  // (preset aplicado, URL navigation, voice action). Antes só sincronizava quando === '',
  // deixando o campo de busca visualmente desatualizado ao navegar para /?search=caneta.
  // O effect não cria loop: quando localSearch muda via user input, o debounce dispara e
  // onFilterChange atualiza filters.search — na próxima checagem, filters.search === localSearch.
  useEffect(() => {
    if (filters.search !== localSearch) {
      setLocalSearch(filters.search || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const { data: categoryIcons = [] } = useCategoryIcons();

  // BUG-DB-03 FIX (2026-06-18): opcoes de Publico-Alvo vinham de products.tags.publicoAlvo,
  // que o catalogo lightweight nunca hidrata (secao ficava eternamente vazia). Agora vem do
  // SSOT v_super_filtro_options (filtro_tipo=target_audience) -> mesmos slugs que a RPC
  // fn_super_filtro_product_ids casa contra products.target_audience.
  const publicoAlvoOptions = usePublicoAlvoOptions();

  const endomarketingOptions = useMemo(() => {
    const set = new Set<string>();
    products?.forEach((p) => p.tags?.endomarketing?.forEach((v) => set.add(v)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const productCountsByRamo = useMemo(() => {
    const ramoCounts = new Map<string, number>();
    const segmentoCounts = new Map<string, number>();
    products?.forEach((p) => {
      p.tags?.ramo?.forEach((r) => {
        const key = r.toLowerCase();
        ramoCounts.set(key, (ramoCounts.get(key) || 0) + 1);
      });
      p.tags?.nicho?.forEach((n) => {
        const key = n.toLowerCase();
        segmentoCounts.set(key, (segmentoCounts.get(key) || 0) + 1);
      });
    });
    return { ramoCounts, segmentoCounts };
  }, [products]);

  const { techniqueOptions, tagOptions } = useAdvancedFilters();
  const { suppliers: supplierOptions, isLoading: suppliersLoading } = useSuppliers();
  // SF-E: tamanhos disponíveis vêm de product_variants (catálogo leve não traz variações).
  const { sizes: availableSizes } = useAvailableSizes();

  const {
    groups: materialGroups,
    materials: allMaterials,
    isLoading: materialsLoading,
    filterState: materialFilterState,
    toggleGroup: toggleMaterialGroup,
    toggleType: toggleMaterialType,
    isGroupSelected: isMaterialGroupSelected,
    getTypesForGroup,
    clearFilters: clearMaterialFilters,
  } = useMaterialFilter();

  const {
    groups: ramoGroups,
    segmentos: allSegmentos,
    isLoading: ramosLoading,
    totalGroups: totalRamoGroups,
    totalSegmentos: totalRamoSegmentos,
    getSegmentosForRamo,
  } = useRamoAtividadeFilter();

  // Sync material sections open state
  useEffect(() => {
    if (
      materialGroups.length > 0 &&
      (materialFilterState.selectedGroups.length > 0 ||
        materialFilterState.selectedTypes.length > 0)
    ) {
      const groupsWithSelection = new Set<string>();
      materialFilterState.selectedGroups.forEach((slug) => groupsWithSelection.add(`mat-${slug}`));
      materialFilterState.selectedTypes.forEach((typeSlug) => {
        const material = allMaterials.find((m) => m.type_slug === typeSlug);
        if (material) groupsWithSelection.add(`mat-${material.group_slug}`);
      });
      setOpenSections((prev) => {
        const newSections = [...prev];
        groupsWithSelection.forEach((section) => {
          if (!newSections.includes(section)) newSections.push(section);
        });
        return newSections;
      });
    }
  }, [
    materialFilterState.selectedGroups,
    materialFilterState.selectedTypes,
    materialGroups,
    allMaterials,
  ]);

  const stableSorted = (arr: string[] | undefined) => [...(arr ?? [])].slice().sort();
  const prevMaterialFiltersRef = useRef<{ groups: string[]; types: string[] }>({
    groups: [],
    types: [],
  });

  useEffect(() => {
    const currentMaterialGroups = filters.materialGroups || [];
    const currentMaterialTypes = filters.materialTypes || [];
    const groupsChanged =
      JSON.stringify(stableSorted(currentMaterialGroups)) !==
      JSON.stringify(stableSorted(materialFilterState.selectedGroups));
    const typesChanged =
      JSON.stringify(stableSorted(currentMaterialTypes)) !==
      JSON.stringify(stableSorted(materialFilterState.selectedTypes));
    if (groupsChanged || typesChanged) {
      const wasExternallyReset =
        currentMaterialGroups.length === 0 &&
        currentMaterialTypes.length === 0 &&
        (prevMaterialFiltersRef.current.groups.length > 0 ||
          prevMaterialFiltersRef.current.types.length > 0);
      if (
        wasExternallyReset &&
        (materialFilterState.selectedGroups.length > 0 ||
          materialFilterState.selectedTypes.length > 0)
      ) {
        clearMaterialFilters();
      } else {
        onFilterChange({
          ...filters,
          materialGroups: materialFilterState.selectedGroups,
          materialTypes: materialFilterState.selectedTypes,
        });
      }
    }
    prevMaterialFiltersRef.current = { groups: currentMaterialGroups, types: currentMaterialTypes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    materialFilterState.selectedGroups,
    materialFilterState.selectedTypes,
    filters.materialGroups,
    filters.materialTypes,
  ]);

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  }, []);

  const toggleArrayFilter = useCallback(
    (key: keyof FilterState, value: string | number) => {
      const currentValues = filters[key] as (string | number)[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      onFilterChange({ ...filters, [key]: newValues });
    },
    [filters, onFilterChange],
  );

  const toggleBooleanFilter = useCallback(
    (key: keyof FilterState) => {
      onFilterChange({ ...filters, [key]: !filters[key] });
    },
    [filters, onFilterChange],
  );

  const collapseAllSections = useCallback(() => {
    setOpenSections([]);
  }, []);

  const sectionCounts = useMemo(() => {
    const colorCount =
      (filters.colorGroups?.length || 0) +
      (filters.colorVariations?.length || 0) +
      (filters.colorNuances?.length || 0) +
      // BUG-COLOR-COUNT FIX: cores legadas (presets/voz) não entravam na badge da seção.
      (filters.colors?.length || 0);
    const materialCount =
      materialFilterState.selectedGroups.length + materialFilterState.selectedTypes.length;
    const ramoCount =
      (filters.ramosAtividade?.length || 0) + (filters.segmentosAtividade?.length || 0);
    const quickCount =
      [
        filters.isKit,
        filters.featured,
        filters.isNew,
        filters.hasPersonalization,
        filters.onSale,
        filters.inStock,
        filters.hasCommercialPackaging,
      ].filter(Boolean).length +
      // BUG-MINSTOCK-BADGE FIX: filtro minStock (input na seção opcoes-rapidas,
      // também ativável via preset/voz) não era contado — badge ficava abaixo do real.
      (filters.minStock > 0 ? 1 : 0);
    return {
      cores: colorCount,
      categorias: filters.categories?.length || 0,

      preco: filters.priceRange[0] > 0 || filters.priceRange[1] < 9999 ? 1 : 0,
      fornecedores: filters.suppliers?.length || 0,
      publico: filters.publicoAlvo?.length || 0,
      'datas-comemorativas': filters.datasComemorativas?.length || 0,
      endomarketing: filters.endomarketing?.length || 0,
      materiais: materialCount,
      'ramos-atividade': ramoCount,
      tecnicas: (filters.techniques || []).length,
      tags: (filters.tags || []).length,
      genero: (filters.gender || []).length,
      tamanhos: (filters.sizes || []).length,
      'vendas-fornecedor': filters.minSupplierSales90d > 0 ? 1 : 0,
      'vendas-promo': filters.minPromoSales90d > 0 ? 1 : 0,
      'opcoes-rapidas': quickCount,
      ordenacao: filters.sortBy !== 'newest' ? 1 : 0,
    } as Record<string, number>;
  }, [filters, materialFilterState]);

  const sectionSummaries = useMemo(() => {
    const summaries: Record<string, string> = {};
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) {
      summaries.preco = `R$${filters.priceRange[0]}–${filters.priceRange[1] >= 9999 ? '∞' : filters.priceRange[1]}`;
    }
    if (filters.sortBy !== 'newest') {
      const opt = SORT_OPTIONS.find((o) => o.value === filters.sortBy);
      summaries.ordenacao = opt?.label ?? '';
    }
    return summaries;
  }, [filters]);

  const sectionMatchesSearch = useCallback(
    (sectionId: string, sectionTitle: string) => {
      if (!filterSearch) return true;
      const q = filterSearch.toLowerCase();
      return sectionTitle.toLowerCase().includes(q) || sectionId.toLowerCase().includes(q);
    },
    [filterSearch],
  );

  return {
    openSections,
    toggleSection,
    collapseAllSections,
    materialSearch,
    setMaterialSearch,
    ramoSearch,
    setRamoSearch,
    supplierSearch,
    setSupplierSearch,
    techniqueSearch,
    setTechniqueSearch,
    tagSearch,
    setTagSearch,
    publicoSearch,
    setPublicoSearch,
    endoSearch,
    setEndoSearch,
    filterSearch,
    setFilterSearch,
    localSearch,
    setLocalSearch,
    categoryIcons,
    publicoAlvoOptions,
    endomarketingOptions,
    productCountsByRamo,
    techniqueOptions,
    tagOptions,
    supplierOptions,
    suppliersLoading,
    availableSizes,
    materialGroups,
    allMaterials,
    materialsLoading,
    materialFilterState,
    toggleMaterialGroup,
    toggleMaterialType,
    isMaterialGroupSelected,
    getTypesForGroup,
    clearMaterialFilters,
    ramoGroups,
    allSegmentos,
    ramosLoading,
    totalRamoGroups,
    totalRamoSegmentos,
    getSegmentosForRamo,
    toggleArrayFilter,
    toggleBooleanFilter,
    sectionCounts,
    sectionSummaries,
    sectionMatchesSearch,
  };
}
