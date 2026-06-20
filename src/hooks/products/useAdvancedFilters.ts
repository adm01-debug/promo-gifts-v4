import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  useExternalCategories,
  useExternalTechniques,
  useExternalSuppliers,
  useExternalDatabase,
  type ExternalCategory,
  type ExternalTechnique,
  type ExternalSupplier,
} from '@/hooks/intelligence/useExternalDatabase';

// Re-exportar tipos e constantes dos novos arquivos
export type {
  ColorOption,
  CategoryOption,
  TechniqueOption,
  SupplierOption,
  MaterialOption,
  StockFilterOption,
  AdvancedFilterState,
  ColorGroupData,
  TagData,
} from '@/types/advancedFilters';

export { defaultAdvancedFilters, STOCK_FILTER_OPTIONS, SORT_OPTIONS } from '@/constants/filters';

import type {
  CategoryOption,
  TechniqueOption,
  SupplierOption,
  ColorOption,
  ColorGroupData,
  TagData,
  AdvancedFilterState,
} from '@/types/advancedFilters';
import { defaultAdvancedFilters } from '@/constants/filters';

import { logger } from '@/lib/logger';
// ============================================
// HOOK PRINCIPAL
// ============================================

export function useAdvancedFilters() {
  const [filters, setFilters] = useState<AdvancedFilterState>(defaultAdvancedFilters);
  // BUG-LOADING-01 FIX: isLoading inicializava como true antes de qualquer fetch ter ocorrido,
  // causando um flash de skeleton desnecessario quando os dados ja estavam em cache.
  const [isLoading, setIsLoading] = useState(false);

  // Hooks para buscar dados do banco externo
  const categoriesDB = useExternalCategories();
  const techniquesDB = useExternalTechniques();
  const suppliersDB = useExternalSuppliers();
  const colorGroupsDB = useExternalDatabase<ColorGroupData>('color_groups');
  const tagsDB = useExternalDatabase<TagData>('tags');

  // BUG-AF-01 FIX: Captura referencias das funcoes em refs para evitar stale closure
  // sem adicionar as funcoes como deps (o que causaria re-fetch infinito).
  // O efeito roda uma vez no mount — comportamento intencional para pre-carregar opcoes de filtro.
  const fetchRefsRef = useRef({
    categoriesFetch: categoriesDB.fetchAll,
    techniquesFetch: techniquesDB.fetchAll,
    suppliersFetch: suppliersDB.fetchAll,
    colorGroupsFetch: colorGroupsDB.fetchAll,
    tagsFetch: tagsDB.fetchAll,
  });

  // Mantém as refs atualizadas sem triggerar o efeito
  useEffect(() => {
    fetchRefsRef.current = {
      categoriesFetch: categoriesDB.fetchAll,
      techniquesFetch: techniquesDB.fetchAll,
      suppliersFetch: suppliersDB.fetchAll,
      colorGroupsFetch: colorGroupsDB.fetchAll,
      tagsFetch: tagsDB.fetchAll,
    };
  }, [
    categoriesDB.fetchAll,
    techniquesDB.fetchAll,
    suppliersDB.fetchAll,
    colorGroupsDB.fetchAll,
    tagsDB.fetchAll,
  ]);

  // Buscar dados iniciais — roda uma vez no mount
  useEffect(() => {
    let isMounted = true;

    const loadFilterOptions = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchRefsRef.current.categoriesFetch({ filters: { is_active: true }, limit: 500 }),
          fetchRefsRef.current.techniquesFetch({ filters: { is_active: true }, limit: 100 }),
          fetchRefsRef.current.suppliersFetch({ limit: 100 }),
          fetchRefsRef.current.colorGroupsFetch({ filters: { is_active: true }, limit: 100 }),
          fetchRefsRef.current.tagsFetch({ limit: 200 }),
        ]);
      } catch (error) {
        logger.error('Erro ao carregar opcoes de filtros:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Transformar categorias em arvore hierarquica
  const categoryTree = useMemo((): CategoryOption[] => {
    const categories = categoriesDB.data as ExternalCategory[];
    if (!categories?.length) return [];

    const categoryMap = new Map<string, CategoryOption>();
    const roots: CategoryOption[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        parentId: cat.parent_id || undefined,
        level: cat.level || 0,
        path: cat.slug,
        children: [],
      });
    });

    categoryMap.forEach((cat) => {
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children ||= [];
          parent.children.push(cat);
        }
      } else {
        roots.push(cat);
      }
    });

    return roots;
  }, [categoriesDB.data]);

  // Lista plana de categorias para selecao
  const categoryOptions = useMemo((): CategoryOption[] => {
    const flattenCategories = (cats: CategoryOption[], level = 0): CategoryOption[] => {
      return cats.flatMap((cat) => [
        { ...cat, level },
        ...flattenCategories(cat.children || [], level + 1),
      ]);
    };
    return flattenCategories(categoryTree);
  }, [categoryTree]);

  // Tecnicas de personalizacao
  const techniqueOptions = useMemo((): TechniqueOption[] => {
    const techniques = techniquesDB.data as ExternalTechnique[];
    return (
      techniques?.map((tech) => ({
        id: tech.id,
        name: tech.name,
        code: tech.code || '',
        estimatedDays: tech.estimated_days,
        minQuantity: tech.min_quantity,
      })) ?? []
    );
  }, [techniquesDB.data]);

  // Fornecedores
  const supplierOptions = useMemo((): SupplierOption[] => {
    const suppliers = suppliersDB.data as ExternalSupplier[];
    return (
      suppliers?.map((sup) => ({
        id: sup.id,
        name: sup.name,
        code: sup.code,
        leadTimeDays: sup.lead_time_days,
      })) ?? []
    );
  }, [suppliersDB.data]);

  // Cores
  const colorOptions = useMemo((): ColorOption[] => {
    const colors = colorGroupsDB.data as ColorGroupData[];
    return (
      colors?.map((color) => ({
        id: color.id,
        name: color.name,
        hex: color.hex_code || '#cccccc',
      })) ?? []
    );
  }, [colorGroupsDB.data]);

  // Tags
  const tagOptions = useMemo(() => {
    const tags = tagsDB.data as TagData[];
    return (
      tags?.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
      })) ?? []
    );
  }, [tagsDB.data]);

  // Funcoes para manipular filtros
  const updateFilter = useCallback(
    <K extends keyof AdvancedFilterState>(key: K, value: AdvancedFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleArrayFilter = useCallback(
    <K extends keyof AdvancedFilterState>(key: K, value: string) => {
      setFilters((prev) => {
        const currentValues = prev[key] as string[];
        const newValues = currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value];
        return { ...prev, [key]: newValues };
      });
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultAdvancedFilters);
  }, []);

  const resetFilterGroup = useCallback((keys: (keyof AdvancedFilterState)[]) => {
    setFilters((prev) => {
      const updates: Partial<AdvancedFilterState> = {};
      keys.forEach((key) => {
        updates[key] = defaultAdvancedFilters[key] as never;
      });
      return { ...prev, ...updates };
    });
  }, []);

  // Contador de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.categories.length) count += filters.categories.length;
    if (filters.suppliers.length) count += filters.suppliers.length;
    if (filters.colors.length) count += filters.colors.length;
    if (filters.materials.length) count += filters.materials.length;
    if (filters.techniques.length) count += filters.techniques.length;
    if (filters.tags.length) count += filters.tags.length;
    if (filters.colorGroups.length) count += filters.colorGroups.length;
    if (filters.colorVariations.length) count += filters.colorVariations.length;
    if (filters.colorNuances.length) count += filters.colorNuances.length;
    if (filters.datasComemorativas.length) count += filters.datasComemorativas.length;
    if (filters.publicoAlvo.length) count += filters.publicoAlvo.length;
    if (filters.endomarketing.length) count += filters.endomarketing.length;
    if (filters.ramosAtividade.length) count += filters.ramosAtividade.length;
    if (filters.segmentosAtividade.length) count += filters.segmentosAtividade.length;
    // Threshold alinhado com PRICE_RANGE_MAX = 9999 em useCatalogFiltering
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) count++;
    // BUG-SF-16 FIX: quantityRange removido de AdvancedFilterState (era campo orphaned).
    if (filters.stockStatus !== 'all') count++;
    if (filters.isKit) count++;
    if (filters.isFeatured) count++;
    if (filters.isNew) count++;
    if (filters.hasPersonalization) count++;
    if (filters.maxLeadTimeDays !== null) count++;
    if (filters.gender?.length) count += filters.gender.length;
    return count;
  }, [filters]);

  // Verificar se ha filtros ativos em um grupo especifico
  const hasActiveFiltersInGroup = useCallback(
    (keys: (keyof AdvancedFilterState)[]) => {
      return keys.some((key) => {
        const value = filters[key];
        const defaultValue = defaultAdvancedFilters[key];

        if (Array.isArray(value)) {
          return value.length > 0;
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value) !== JSON.stringify(defaultValue);
        }
        return value !== defaultValue;
      });
    },
    [filters],
  );

  return {
    filters,
    isLoading,
    activeFiltersCount,
    categoryTree,
    categoryOptions,
    techniqueOptions,
    supplierOptions,
    colorOptions,
    tagOptions,
    updateFilter,
    toggleArrayFilter,
    resetFilters,
    resetFilterGroup,
    setFilters,
    hasActiveFiltersInGroup,
  };
}
