import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdvancedFilters } from '@/hooks/products';
import type { AdvancedFilterState } from '@/types/advancedFilters';

export interface ContextualSuggestion {
  id: string;
  text: string;
  icon?: string;
  type: 'action' | 'filter' | 'search';
  priority: number;
  filterKey?: keyof AdvancedFilterState;
  filterValue?: unknown;
}

export interface RouteContext {
  section: string;
}

interface UseContextualSuggestionsOptions {
  searchQuery?: string;
  activeFilters?: Partial<AdvancedFilterState>;
  enabled?: boolean;
}

const FILTER_LABELS: Partial<Record<keyof AdvancedFilterState, string>> = {
  categories: 'Categoria',
  suppliers: 'Fornecedor',
  colors: 'Cor',
  techniques: 'Técnica',
  materials: 'Material',
  tags: 'Tag',
  ramosAtividade: 'Ramo de atividade',
  priceRange: 'Faixa de preço',
  stockStatus: 'Estoque',
};

function deriveSection(pathname: string): string {
  if (/produto|catalogo|catálogo/i.test(pathname)) return 'products';
  if (/orcamento|orçamento|quote/i.test(pathname)) return 'quotes';
  return '';
}

function isActiveValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '' && value !== 'all';
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'boolean') return value;
  return value !== null && value !== undefined;
}

/**
 * Sugestões contextuais para a busca global: deriva a seção da rota atual
 * ({ section }) e propõe filtros complementares / remoção de filtros ativos
 * a partir do AdvancedFilterState real.
 */
export function useContextualSuggestions({
  searchQuery = '',
  activeFilters = {},
  enabled = true,
}: UseContextualSuggestionsOptions = {}) {
  const location = useLocation();
  const routeContext: RouteContext = useMemo(
    () => ({ section: deriveSection(location.pathname) }),
    [location.pathname],
  );

  const { techniqueOptions } = useAdvancedFilters();

  const allSuggestions = useMemo<ContextualSuggestion[]>(() => {
    if (!enabled) return [];
    const out: ContextualSuggestion[] = [];

    const hasCategories = isActiveValue(activeFilters.categories);
    const hasSuppliers = isActiveValue(activeFilters.suppliers);
    const hasColors = isActiveValue(activeFilters.colors);
    const hasTechniques = isActiveValue(activeFilters.techniques);

    if (hasCategories && !hasSuppliers) {
      out.push({
        id: 'suggest-supplier',
        text: 'Filtrar por fornecedor',
        icon: '🏭',
        type: 'filter',
        priority: 8,
        filterKey: 'suppliers',
      });
    }

    if (hasSuppliers && !hasCategories) {
      out.push({
        id: 'suggest-category',
        text: 'Ver categorias do fornecedor',
        icon: '📁',
        type: 'filter',
        priority: 7,
        filterKey: 'categories',
      });
    }

    if (hasColors && !hasTechniques && techniqueOptions.length > 0) {
      out.push({
        id: 'suggest-technique',
        text: 'Selecionar técnica de personalização',
        icon: '🎨',
        type: 'filter',
        priority: 6,
        filterKey: 'techniques',
      });
    }

    (Object.entries(activeFilters) as [keyof AdvancedFilterState, unknown][]).forEach(
      ([key, value]) => {
        if (isActiveValue(value)) {
          out.push({
            id: `remove-${key}`,
            text: `Remover filtro: ${FILTER_LABELS[key] ?? key}`,
            icon: '✕',
            type: 'action',
            priority: 5,
            filterKey: key,
            filterValue: value,
          });
        }
      },
    );

    if (Object.values(activeFilters).some(isActiveValue)) {
      out.push({
        id: 'clear-filters',
        text: 'Limpar todos os filtros',
        icon: '🧹',
        type: 'action',
        priority: 3,
      });
    }

    return out.sort((a, b) => b.priority - a.priority);
  }, [enabled, activeFilters, techniqueOptions]);

  const suggestions = useMemo<ContextualSuggestion[]>(() => {
    if (!searchQuery.trim()) return allSuggestions;
    const normalizedQuery = searchQuery.toLowerCase().trim();

    return allSuggestions
      .filter((s) => s.text.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const startsWith = (s: ContextualSuggestion) =>
          s.text.toLowerCase().startsWith(normalizedQuery);
        if (startsWith(a) && !startsWith(b)) return -1;
        if (!startsWith(a) && startsWith(b)) return 1;
        return b.priority - a.priority;
      })
      .slice(0, 5);
  }, [allSuggestions, searchQuery]);

  return {
    suggestions,
    allSuggestions,
    hasSuggestions: suggestions.length > 0,
    routeContext,
  };
}
