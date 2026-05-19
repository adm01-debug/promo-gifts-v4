import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SORT_OPTIONS } from "@/hooks/products";
import { InlineColorGroupFilter } from "./InlineColorGroupFilter";
import { ExternalCategoryFilter } from "./ExternalCategoryFilter";
import { DebouncedPriceInput } from "./DebouncedPriceInput";
import { CommemorativeDateFilter } from "./CommemorativeDateFilter";
import type { ColorFilterSelection } from "./ColorGroupFilter";

// Re-export types for backward compatibility
export type { FilterState, FilterPanelProps } from "./filter-panel/types";
export { defaultFilters, SECTION_CONFIG, SECTION_GROUPS } from "./filter-panel/types";

import { type FilterPanelProps, SECTION_CONFIG, SECTION_GROUPS } from "./filter-panel/types";
import { useFilterPanelState } from "./filter-panel/useFilterPanelState";
import { FilterSection, GroupSeparator } from "./filter-panel/FilterSection";
import { FilterPanelHeader } from "./filter-panel/FilterPanelHeader";
import { SuppliersFilter } from "./filter-panel/sections/SuppliersFilter";
import { MaterialsFilter } from "./filter-panel/sections/MaterialsFilter";
import { RamosFilter } from "./filter-panel/sections/RamosFilter";
import {
  PublicoFilter,
  EndomarketingFilter,
  TechniquesFilter,
  TagsFilter,
  QuickOptionsFilter,
} from "./filter-panel/sections/SimpleFilters";
import { SizeFilter } from "./filter-panel/sections/SizeFilter";
import { GenderBadge } from "@/components/products/GenderBadge";

export function FilterPanel({
  filters, onFilterChange, onReset, activeFiltersCount,
  products = [], viewMode, onViewModeChange, gridColumns, onGridColumnsChange, filteredResultsCount,
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
        selection={{ groups: filters.colorGroups, variations: filters.colorVariations, nuances: filters.colorNuances }}
        onChange={(selection: ColorFilterSelection) => {
          onFilterChange({ ...filters, colorGroups: selection.groups, colorVariations: selection.variations, colorNuances: selection.nuances });
        }}
        showNuances showVariations
      />
    ),
    categorias: () => (
      <ExternalCategoryFilter
        selectedCategories={filters.categories}
        onCategoriesChange={(categories) => onFilterChange({ ...filters, categories })}
        compact
      />
    ),
    estoque: () => (
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs whitespace-nowrap">Mínimo por cor</span>
          <DebouncedPriceInput value={filters.minStock || ''} onChange={(v) => onFilterChange({ ...filters, minStock: v })} fallback={0} placeholder="Ex: 500" min={0} className={filters.minStock > 0 ? 'border-orange/60' : ''} />
          <span className="text-muted-foreground text-xs">un.</span>
        </div>
      </div>
    ),
    preco: () => (
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-muted-foreground text-xs">R$</span>
            <DebouncedPriceInput value={filters.priceRange[0]} onChange={(v) => onFilterChange({ ...filters, priceRange: [v, filters.priceRange[1]] })} fallback={0} min={0} className={filters.priceRange[0] > 0 ? 'border-orange/60' : ''} />
          </div>
          <span className="text-muted-foreground text-xs">até</span>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-muted-foreground text-xs">R$</span>
            <DebouncedPriceInput value={filters.priceRange[1] >= 9999 ? '' : filters.priceRange[1]} onChange={(v) => onFilterChange({ ...filters, priceRange: [filters.priceRange[0], v || 9999] })} fallback={9999} placeholder="Sem limite" min={0} className={filters.priceRange[1] < 9999 ? 'border-orange/60' : ''} />
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
    publico: () => (
      <PublicoFilter
        filters={filters}
        publicoAlvoOptions={state.publicoAlvoOptions}
        publicoSearch={state.publicoSearch}
        setPublicoSearch={state.setPublicoSearch}
        toggleArrayFilter={state.toggleArrayFilter}
      />
    ),
    "datas-comemorativas": () => (
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
    "ramos-atividade": () => (
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
    "opcoes-rapidas": () => (
      <QuickOptionsFilter filters={filters} toggleBooleanFilter={state.toggleBooleanFilter} />
    ),
    ordenacao: () => (
      <Select value={filters.sortBy || 'name'} onValueChange={(value) => onFilterChange({ ...filters, sortBy: value })}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
    genero: () => {
      const GENDER_OPTIONS = ["Unissex", "Masculino", "Feminino", "Infantil"];
      return (
        <div className="flex flex-wrap gap-1.5 px-1">
          {GENDER_OPTIONS.map((g) => {
            const isSelected = (filters.gender || []).includes(g);
            return (
              <button
                key={g}
                onClick={() => state.toggleArrayFilter("gender", g)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-foreground hover:border-primary/40 hover:bg-accent"
                }`}
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
        selectedSizes={filters.sizes || []}
        onToggleSize={(size) => state.toggleArrayFilter("sizes", size)}
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
          const visibleSections = group.sections.filter(sId => {
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
                {visibleSections.map(sId => renderSection(sId, sectionRenderers[sId]))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
