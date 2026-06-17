import React from 'react';
import { Search, X, Clock, Gift } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toTitleCase } from '@/lib/textUtils';
import type { FilterState } from '../types';

// ============================================
// Searchable Checkbox List (shared pattern)
// ============================================
interface SearchableCheckboxListProps {
  items: Array<{ id: string; label: string; extra?: React.ReactNode }>;
  selected: string[];
  onToggle: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  emptyMessage: string;
  showSearchThreshold?: number;
}

export function SearchableCheckboxList({
  items,
  selected,
  onToggle,
  search,
  setSearch,
  searchPlaceholder,
  searchLabel,
  emptyMessage,
  showSearchThreshold = 5,
}: SearchableCheckboxListProps) {
  const filtered = items.filter(
    (i) => !search || i.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      {items.length > showSearchThreshold && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
            aria-label={searchLabel}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div
        className="scrollbar-thin max-h-48 overflow-y-auto overscroll-contain"
        style={{ overscrollBehavior: 'contain' }}
      >
        {filtered.map((item) => (
          <div key={item.id} className="flex items-center gap-2 py-0.5">
            <Checkbox
              id={item.id}
              checked={selected.includes(item.id)}
              onCheckedChange={() => onToggle(item.id)}
            />
            <Label
              htmlFor={item.id}
              className="flex flex-1 cursor-pointer items-center justify-between text-sm"
            >
              <span>{item.label}</span>
              {item.extra}
            </Label>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Público-Alvo Filter
// ============================================
export function PublicoFilter({
  filters,
  publicoAlvoOptions,
  publicoSearch,
  setPublicoSearch,
  toggleArrayFilter,
}: {
  filters: FilterState;
  publicoAlvoOptions: string[];
  publicoSearch: string;
  setPublicoSearch: (v: string) => void;
  toggleArrayFilter: (key: keyof FilterState, value: string) => void;
}) {
  // BUG-SF-14 FIX: mensagem confusa "Carregando..." antes mesmo dos produtos começarem a carregar.
  if (publicoAlvoOptions.length === 0)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
        Disponível após carregar o catálogo
      </p>
    );
  return (
    <SearchableCheckboxList
      items={publicoAlvoOptions.map((p) => ({ id: `pub-${p}`, label: toTitleCase(p) }))}
      selected={publicoAlvoOptions
        .filter((p) => filters.publicoAlvo.includes(p))
        .map((p) => `pub-${p}`)}
      onToggle={(id) => toggleArrayFilter('publicoAlvo', id.replace('pub-', ''))}
      search={publicoSearch}
      setSearch={setPublicoSearch}
      searchPlaceholder="Buscar público..."
      searchLabel="Buscar público-alvo"
      emptyMessage="Nenhum público encontrado"
    />
  );
}

// ============================================
// Endomarketing Filter
// ============================================
export function EndomarketingFilter({
  filters,
  endomarketingOptions,
  endoSearch,
  setEndoSearch,
  toggleArrayFilter,
}: {
  filters: FilterState;
  endomarketingOptions: string[];
  endoSearch: string;
  setEndoSearch: (v: string) => void;
  toggleArrayFilter: (key: keyof FilterState, value: string) => void;
}) {
  // BUG-SF-14 FIX: mensagem confusa antes dos produtos carregarem.
  if (endomarketingOptions.length === 0)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
        Disponível após carregar o catálogo
      </p>
    );
  return (
    <SearchableCheckboxList
      items={endomarketingOptions.map((e) => ({ id: `endo-${e}`, label: toTitleCase(e) }))}
      selected={endomarketingOptions
        .filter((e) => filters.endomarketing.includes(e))
        .map((e) => `endo-${e}`)}
      onToggle={(id) => toggleArrayFilter('endomarketing', id.replace('endo-', ''))}
      search={endoSearch}
      setSearch={setEndoSearch}
      searchPlaceholder="Buscar endomarketing..."
      searchLabel="Buscar endomarketing"
      emptyMessage="Nenhuma opção encontrada"
    />
  );
}

// ============================================
// Techniques Filter
// ============================================
export function TechniquesFilter({
  filters,
  techniqueOptions,
  techniqueSearch,
  setTechniqueSearch,
  toggleArrayFilter,
}: {
  filters: FilterState;
  techniqueOptions: Array<{ id: string; name: string; estimatedDays?: number | null }>;
  techniqueSearch: string;
  setTechniqueSearch: (v: string) => void;
  toggleArrayFilter: (key: keyof FilterState, value: string) => void;
}) {
  if (techniqueOptions.length === 0) return null;
  return (
    <div className="space-y-2">
      {techniqueOptions.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar técnica..."
            value={techniqueSearch}
            onChange={(e) => setTechniqueSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
            aria-label="Buscar técnica de gravação"
          />
          {techniqueSearch && (
            <button
              type="button"
              onClick={() => setTechniqueSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div
        className="max-h-40 overflow-y-auto overscroll-contain pr-3"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="space-y-2">
          {techniqueOptions
            .filter(
              (t) =>
                !techniqueSearch || t.name.toLowerCase().includes(techniqueSearch.toLowerCase()),
            )
            .map((tech) => (
              <div key={tech.id} className="flex items-center gap-2">
                <Checkbox
                  id={`tech-${tech.id}`}
                  checked={(filters.techniques ?? []).includes(tech.id)}
                  onCheckedChange={() => toggleArrayFilter('techniques', tech.id)}
                />
                <Label
                  htmlFor={`tech-${tech.id}`}
                  className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                >
                  <span>{tech.name}</span>
                  {tech.estimatedDays && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {tech.estimatedDays}d
                    </span>
                  )}
                </Label>
              </div>
            ))}
          {techniqueOptions.filter(
            (t) => !techniqueSearch || t.name.toLowerCase().includes(techniqueSearch.toLowerCase()),
          ).length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Nenhuma técnica encontrada
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tags Filter
// ============================================
export function TagsFilter({
  filters,
  tagOptions,
  tagSearch,
  setTagSearch,
  toggleArrayFilter,
}: {
  filters: FilterState;
  tagOptions: Array<{ id: string; name: string }>;
  tagSearch: string;
  setTagSearch: (v: string) => void;
  toggleArrayFilter: (key: keyof FilterState, value: string) => void;
}) {
  if (tagOptions.length === 0) return null;
  return (
    <div className="space-y-2">
      {tagOptions.length > 10 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tag..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
            aria-label="Buscar tag"
          />
          {tagSearch && (
            <button
              type="button"
              onClick={() => setTagSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div
        className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-1"
        style={{ overscrollBehavior: 'contain' }}
      >
        {(() => {
          // BUG-SF-12 FIX: limite era 30 sem indicador — aumentado para 50 e adicionado
          // aviso "+X mais" quando o total filtrado excede o limite.
          const TAG_DISPLAY_LIMIT = 50;
          const filtered = tagOptions.filter(
            (t) => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()),
          );
          const displayed = filtered.slice(0, TAG_DISPLAY_LIMIT);
          const hidden = filtered.length - displayed.length;
          return (
            <>
              {displayed.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleArrayFilter('tags', tag.id)}
                  aria-label={`Tag ${tag.name}`}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-all',
                    (filters.tags ?? []).includes(tag.id)
                      ? 'border-brand-primary bg-brand-primary text-brand-primary-foreground'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {tag.name}
                </button>
              ))}
              {hidden > 0 && (
                <span className="self-center text-[11px] text-muted-foreground">
                  +{hidden} mais — use a busca acima para filtrar
                </span>
              )}
              {filtered.length === 0 && (
                <p className="w-full py-2 text-center text-xs text-muted-foreground">
                  Nenhuma tag encontrada
                </p>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ============================================
// Quick Options Filter
// ============================================
export function QuickOptionsFilter({
  filters,
  toggleBooleanFilter,
}: {
  filters: FilterState;
  toggleBooleanFilter: (key: keyof FilterState) => void;
}) {
  return (
    <div
      className="max-h-48 space-y-2 overflow-y-auto overscroll-contain"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-isKit"
          checked={filters.isKit}
          onCheckedChange={() => toggleBooleanFilter('isKit')}
        />
        <Label htmlFor="filter-isKit" className="cursor-pointer text-sm">
          Apenas KITs
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-featured"
          checked={filters.featured}
          onCheckedChange={() => toggleBooleanFilter('featured')}
        />
        <Label htmlFor="filter-featured" className="cursor-pointer text-sm">
          Destaques
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-onSale"
          checked={filters.onSale}
          onCheckedChange={() => toggleBooleanFilter('onSale')}
        />
        <Label htmlFor="filter-onSale" className="cursor-pointer text-sm">
          Promoções
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-isNew"
          checked={filters.isNew}
          onCheckedChange={() => toggleBooleanFilter('isNew')}
        />
        <Label htmlFor="filter-isNew" className="cursor-pointer text-sm">
          Novidades
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-hasPersonalization"
          checked={filters.hasPersonalization}
          onCheckedChange={() => toggleBooleanFilter('hasPersonalization')}
        />
        <Label htmlFor="filter-hasPersonalization" className="cursor-pointer text-sm">
          Com Personalização
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-inStock"
          checked={filters.inStock}
          onCheckedChange={() => toggleBooleanFilter('inStock')}
        />
        <Label htmlFor="filter-inStock" className="cursor-pointer text-sm">
          Em Estoque
        </Label>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2">
        <Checkbox
          id="has-commercial-packaging"
          checked={filters.hasCommercialPackaging}
          onCheckedChange={() => toggleBooleanFilter('hasCommercialPackaging')}
          className="border-warning/50 data-[state=checked]:border-warning data-[state=checked]:bg-warning"
        />
        <Label
          htmlFor="has-commercial-packaging"
          className="flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <Gift className="h-3.5 w-3.5 text-warning" />
          Com Embalagem Nativa
        </Label>
      </div>
    </div>
  );
}
