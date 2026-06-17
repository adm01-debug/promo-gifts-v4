import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// FIX-07: era importado de "@/hooks/products" — lista potencialmente diferente da exibida no header.
// Fonte única de verdade: @/constants/filters (mesmo arquivo usado por FiltersPage.tsx).
import { SORT_OPTIONS } from '@/constants/filters';
import { InlineColorGroupFilter } from './InlineColorGroupFilter';
import { ExternalCategoryFilter } from './ExternalCategoryFilter';
import { DebouncedPriceInput } from './DebouncedPriceInput';
import { CommemorativeDateFilter } from './CommemorativeDateFilter';
import type { ColorFilterSelection } from './ColorGroupFilter';

// Re-export types for backward compatibility
export type { FilterState, FilterPanelProps } from './filter-panel/types';
export { defaultFilters, SECTION_CONFIG, SECTION_GROUPS } from './filter-panel/types';

import { type FilterPanelProps, SECTION_CONFIG, SECTION_GROUPS } from './filter-panel/types';
import { useFilterPanelState } from './filter-panel/useFilterPanelState';
import { FilterSection, GroupSeparator } from './filter-panel/FilterSection';
import { FilterPanelHeader } from './filter-panel/FilterPanelHeader';
import { SuppliersFilter } from './filter-panel/sections/SuppliersFilter';
import { MaterialsFilter } from './filter-panel/sections/MaterialsFilter';
import { RamosFilter } from './filter-panel/sections/RamosFilter';
import {
  PublicoFilter,
  EndomarketingFilter,
  TechniquesFilter,
  TagsFilter,
  QuickOptionsFilter,
} from './filter-panel/sections/SimpleFilters';
import { SizeFilter } from './filter-panel/sections/SizeFilter';
import { cn } from '@/lib/utils';

export function FilterPanel({
  filters,
  onFilterChange,
  onReset,
  activeFiltersCount,
  products = [],
}: FilterPanelProps) {
  const state = useFilterPanelState(filters, onFilterChange, products);

  const renderSection = (id: string, renderContent: () => React.ReactNode) => {
    const config = SECTION_CONFIG[id];
    if (!config) return null;
    if (!state.sectionMatchesSearch(id, config.title)) return null;
    return (
      <FilterSection
        key={id}
        id={id}
        title={config.title}
        icon={config.icon}
        openSections={state.openSections}
        onToggle={state.toggleSection}
        activeCount={state.sectionCounts[id]}
        activeSummary={state.sectionSummaries[id]}
      >
        {state.openSections.includes(id) && renderContent()}
      </FilterSection>
    );
  };

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    cores: () => (
      <InlineColorGroupFilter
        selection={{
          groups: filters.colorGroups,
          variations: filters.colorVariations,
          nuances: filters.colorNuances,
        }}
        onChange={(selection: ColorFilterSelection) => {
          onFilterChange({
            ...filters,
            colorGroups: selection.groups,
            colorVariations: selection.variations,
            colorNuances: selection.nuances,
          });
        }}
        showNuances
        showVariations
      />
    ),
    categorias: () => (
      <ExternalCategoryFilter
        selectedCategories={filters.categories}
        onCategoriesChange={(categories) => onFilterChange({ ...filters, categories })}
        compact
      />
    ),
    preco: () => (
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex flex-1 items-center gap-1">
            <span className="text-xs text-muted-foreground">R$</span>
            <DebouncedPriceInput
              value={filters.priceRange[0]}
              onChange={(v) =>
                onFilterChange({ ...filters, priceRange: [v, filters.priceRange[1]] })
              }
              fallback={0}
              min={0}
              className={filters.priceRange[0] > 0 ? 'border-brand-primary/60' : ''}
            />
          </div>
          <span className="text-xs text-muted-foreground">até</span>
          <div className="flex flex-1 items-center gap-1">
            <span className="text-xs text-muted-foreground">R$</span>
            <DebouncedPriceInput
              value={filters.priceRange[1] >= 9999 ? '' : filters.priceRange[1]}
              onChange={(v) =>
                onFilterChange({ ...filters, priceRange: [filters.priceRange[0], v || 9999] })
              }
              fallback={9999}
              placeholder="Sem limite"
              min={0}
              className={filters.priceRange[1] < 9999 ? 'border-brand-primary/60' : ''}
            />
          </div>
        </div>
      </div>
    ),
    fornecedores: () => (
      <SuppliersFilter
        filters={filters}
        supplierSearch={state.supplierSearch}
        setSupplierSearch={state.setSupplierSearch}
        supplierOptions={state.supplierOptions}
        suppliersLoading={state.suppliersLoading}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    'vendas-fornecedor': () => (
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Mín. vendas</span>
          <DebouncedPriceInput
            value={filters.minSupplierSales90d || ''}
            onChange={(v) => onFilterChange({ ...filters, minSupplierSales90d: v })}
            fallback={0}
            placeholder="Ex: 1500"
            min={0}
            className={filters.minSupplierSales90d > 0 ? 'border-brand-primary/60' : ''}
          />
          <span className="text-xs text-muted-foreground">un./90d</span>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          Filtra produtos com pelo menos X unidades vendidas pelo fornecedor nos últimos 90 dias.
        </p>
      </div>
    ),
    'vendas-promo': () => (
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Mín. vendas</span>
          <DebouncedPriceInput
            value={filters.minPromoSales90d || ''}
            onChange={(v) => onFilterChange({ ...filters, minPromoSales90d: v })}
            fallback={0}
            placeholder="Ex: 100"
            min={0}
            className={filters.minPromoSales90d > 0 ? 'border-brand-primary/60' : ''}
          />
          <span className="text-xs text-muted-foreground">un./90d</span>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          Filtra produtos com pelo menos X unidades em pedidos fechados nos últimos 90 dias.
        </p>
      </div>
    ),
    publico: () => (
      <PublicoFilter
        filters={filters}
        publicoAlvoOptions={state.publicoAlvoOptions}
        publicoSearch={state.publicoSearch}
        setPublicoSearch={state.setPublicoSearch}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    'datas-comemorativas': () => (
      <CommemorativeDateFilter
        selectedDates={filters.datasComemorativas}
        onToggleDate={(slug) => state.toggleArrayFilter('datasComemorativas', slug)}
        onClearDates={() => onFilterChange({ ...filters, datasComemorativas: [] })}
        compact
      />
    ),
    endomarketing: () => (
      <EndomarketingFilter
        filters={filters}
        endomarketingOptions={state.endomarketingOptions}
        endoSearch={state.endoSearch}
        setEndoSearch={state.setEndoSearch}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    materiais: () => (
      <MaterialsFilter
        materialSearch={state.materialSearch}
        setMaterialSearch={state.setMaterialSearch}
        materialGroups={state.materialGroups}
        allMaterials={state.allMaterials}
        materialsLoading={state.materialsLoading}
        materialFilterState={state.materialFilterState}
        toggleMaterialGroup={state.toggleMaterialGroup}
        toggleMaterialType={state.toggleMaterialType}
        isMaterialGroupSelected={state.isMaterialGroupSelected}
        getTypesForGroup={state.getTypesForGroup}
        openSections={state.openSections}
        toggleSection={state.toggleSection}
      />
    ),
    'ramos-atividade': () => (
      <RamosFilter
        filters={filters}
        onFilterChange={onFilterChange}
        ramoSearch={state.ramoSearch}
        setRamoSearch={state.setRamoSearch}
        ramoGroups={state.ramoGroups}
        allSegmentos={state.allSegmentos}
        ramosLoading={state.ramosLoading}
        totalRamoGroups={state.totalRamoGroups}
        totalRamoSegmentos={state.totalRamoSegmentos}
        getSegmentosForRamo={state.getSegmentosForRamo}
        productCountsByRamo={state.productCountsByRamo}
      />
    ),
    tecnicas: () => (
      <TechniquesFilter
        filters={filters}
        techniqueOptions={state.techniqueOptions}
        techniqueSearch={state.techniqueSearch}
        setTechniqueSearch={state.setTechniqueSearch}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    tags: () => (
      <TagsFilter
        filters={filters}
        tagOptions={state.tagOptions}
        tagSearch={state.tagSearch}
        setTagSearch={state.setTagSearch}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    'opcoes-rapidas': () => (
      <QuickOptionsFilter filters={filters} toggleBooleanFilter={state.toggleBooleanFilter} />
    ),
    ordenacao: () => (
      <Select
        value={filters.sortBy || 'newest'}
        onValueChange={(value) => onFilterChange({ ...filters, sortBy: value })}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
    genero: () => {
      const GENDER_OPTIONS = ['Unissex', 'Masculino', 'Feminino', 'Infantil'];
      return (
        <div className="flex flex-wrap gap-1.5 px-1">
          {GENDER_OPTIONS.map((g) => {
            const isSelected = (filters.gender ?? []).includes(g);
            return (
              <button
                key={g}
                onClick={() => state.toggleArrayFilter('gender', g)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent',
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      );
    },
    tamanhos: () => (
      <SizeFilter
        selectedSizes={filters.sizes ?? []}
        onToggleSize={(size) => state.toggleArrayFilter('sizes', size)}
        products={products as Array<{ variations?: Array<{ size_code?: string | null }> }>}
      />
    ),
  };

  return (
    <div className="space-y-0">
      <FilterPanelHeader
        activeFiltersCount={activeFiltersCount}
        onReset={onReset}
        collapseAllSections={state.collapseAllSections}
        filterSearch={state.filterSearch}
        setFilterSearch={state.setFilterSearch}
      />

      <div className="space-y-0">
        {SECTION_GROUPS.map((group) => {
          const visibleSections = group.sections.filter((sId) => {
            const config = SECTION_CONFIG[sId];
            if (!config) return false;
            if (!state.sectionMatchesSearch(sId, config.title)) return false;
            if (sId === 'tecnicas' && state.techniqueOptions.length === 0) return false;
            if (sId === 'tags' && state.tagOptions.length === 0) return false;
            return true;
          });
          if (visibleSections.length === 0) return null;
          return (
            <div key={group.label}>
              <GroupSeparator label={group.label} icon={group.icon} />
              <div className="space-y-0">
                {visibleSections.map((sId) => renderSection(sId, sectionRenderers[sId]))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
