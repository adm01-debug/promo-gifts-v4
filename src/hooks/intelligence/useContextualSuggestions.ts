import { useMemo } from 'react';
import { useAdvancedFilters } from '@/hooks/products';
import type { AdvancedFilterState, AdvancedFilterOption } from '@/types/advancedFilters';

export interface ContextualSuggestion {
  id: string;
  text: string;
  type: 'filter' | 'search' | 'action';
  priority: number;
  filterKey?: keyof AdvancedFilterState;
  filterValue?: unknown;
}

interface UseContextualSuggestionsOptions {
  query?: string;
  activeFilters?: Partial<AdvancedFilterState>;
  enabled?: boolean;
}

// Helper: get filter label by key
function getFilterLabel(key: keyof AdvancedFilterState): string {
  const labels: Partial<Record<keyof AdvancedFilterState, string>> = {
    categoria: 'Categoria',
    fornecedor: 'Fornecedor',
    cor: 'Cor',
    precoMin: 'Preço mínimo',
    precoMax: 'Preço máximo',
    estoque: 'Estoque',
    tecnica: 'Técnica',
    material: 'Material',
    ramo: 'Ramo de atividade',
  };
  return labels[key] ?? key;
}

// Helper: get display value for filter value
function getFilterValueDisplay(key: keyof AdvancedFilterState, value: unknown): string {
  if (key === 'estoque') {
    const stockLabels: Record<string, string> = {
      'em_estoque': 'Em estoque',
      'baixo_estoque': 'Baixo estoque',
      'sem_estoque': 'Sem estoque',
    };
    return stockLabels[value as string] ?? String(value);
  }
  if (key === 'precoMin' || key === 'precoMax') {
    return `R$ ${Number(value).toFixed(2)}`;
  }
  const opt = value as AdvancedFilterOption;
  return opt?.label ?? String(value);
}

// Contextual suggestions based on applied filters
export function useContextualSuggestions(
  { query = '', activeFilters = {}, enabled = true }: UseContextualSuggestionsOptions = {}
) {
  const { data: filtersData } = useAdvancedFilters();

  const suggestions: ContextualSuggestion[] = useMemo(() => {
    if (!enabled) return [];
    const suggestions: ContextualSuggestion[] = [];

    // Suggest complementary filters based on active ones
    if (activeFilters.categoria && !activeFilters.fornecedor) {
      suggestions.push({
        id: 'suggest-supplier',
        text: `Filtrar por fornecedor em ${(activeFilters.categoria as AdvancedFilterOption)?.label ?? ''}`,
        type: 'filter',
        priority: 8,
      });
    }

    if (activeFilters.fornecedor && !activeFilters.categoria) {
      suggestions.push({
        id: 'suggest-category',
        text: `Ver categorias de ${(activeFilters.fornecedor as AdvancedFilterOption)?.label ?? ''}`,
        type: 'filter',
        priority: 7,
      });
    }

    if (activeFilters.cor && !activeFilters.tecnica && filtersData?.tecnicas?.length) {
      suggestions.push({
        id: 'suggest-technique',
        text: `Selecionar técnica de personalização`,
        type: 'filter',
        priority: 6,
      });
    }

    if (Object.keys(activeFilters).length > 0) {
      suggestions.push({
        id: 'clear-filters',
        text: 'Limpar todos os filtros',
        type: 'action',
        priority: 3,
      });
    }

    // Active filter removal suggestions
    (Object.entries(activeFilters) as [keyof AdvancedFilterState, unknown][]).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        suggestions.push({
          id: `remove-${key}`,
          text: `Remover filtro: ${getFilterLabel(key)} = ${getFilterValueDisplay(key, value)}`,
          type: 'action',
          priority: 5,
          filterKey: key,
        });
      }
    });

    return suggestions.sort((a, b) => b.priority - a.priority);
  }, [enabled, activeFilters, filtersData]);

  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return suggestions;
    const normalizedQuery = query.toLowerCase().trim();
    
    return suggestions
      .filter(s => s.text.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        // Prioritize starts-with matches
        const aStartsWith = (s: ContextualSuggestion) => s.text.toLowerCase().startsWith(normalizedQuery);
        if (aStartsWith(a) && !aStartsWith(b)) return -1;
        if (!aStartsWith(a) && aStartsWith(b)) return 1;
        return b.priority - a.priority;
      })
      .slice(0, 5);
  }, [suggestions, query]);

  return {
    suggestions: filteredSuggestions,
    allSuggestions: suggestions,
    hasSuggestions: filteredSuggestions.length > 0,
  };
}
