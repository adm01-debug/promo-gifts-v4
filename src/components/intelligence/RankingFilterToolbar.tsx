import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, X, Tag, History, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useSearchHistory } from '@/hooks/common';
import { cn } from '@/lib/utils';

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-primary/20 px-0.5 text-primary">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export { HighlightMatch };

const PERIOD_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1 ano', days: 360 },
];

const LIMIT_OPTIONS = [10, 20, 30, 50];

interface Supplier {
  id: string;
  name: string;
}
interface Category {
  id: number | string;
  name: string;
}

export interface RankingFilters {
  searchTerm: string;
  debouncedSearch: string;
  days: number;
  limit: number;
  supplierId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hasActiveFilters: boolean;
}

interface RankingFilterToolbarProps {
  filters: RankingFilters;
  suppliers: Supplier[];
  categories: Category[];
  onSearchChange: (value: string) => void;
  onDaysChange: (days: number) => void;
  onLimitChange: (limit: number) => void;
  onSupplierChange: (id: string | null, name: string | null) => void;
  onCategoryChange: (id: string | null, name: string | null) => void;
  onClearAll: () => void;
}

export function RankingFilterToolbar({
  filters,
  suppliers,
  categories,
  onSearchChange,
  onDaysChange,
  onLimitChange,
  onSupplierChange,
  onCategoryChange,
  onClearAll,
}: RankingFilterToolbarProps) {
  const [supOpen, setSupOpen] = useState(false);
  const [supSearch, setSupSearch] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    history: searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  } = useSearchHistory('general');

  const filteredSuppliers = useMemo(() => {
    if (!supSearch.trim()) return suppliers;
    const q = supSearch.toLowerCase().trim();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supSearch]);

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const handleSearchSubmit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    onSearchChange(trimmed);
    if (trimmed.length >= 2) {
      addToHistory({
        id: `search-${trimmed}`,
        label: trimmed,
        type: 'general',
      });
    }
    setHistoryOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Search bar with history */}
      <div className="relative w-full">
        <Popover open={historyOpen && searchHistory.length > 0} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <div className="group relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder='Ex: "squeeze metal", "caneta", "mochila"...'
                value={filters.searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (!historyOpen && searchHistory.length > 0) setHistoryOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(filters.searchTerm);
                  }
                }}
                className="h-10 border-muted-foreground/20 bg-background pl-9 text-sm focus-visible:ring-primary/20"
              />
              {filters.searchTerm && (
                <button
                  aria-label="Limpar busca"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="max-h-[300px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between border-b bg-muted/30 p-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" /> Histórico de Busca
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] transition-colors hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  clearHistory();
                }}
              >
                Limpar
              </Button>
            </div>
            <div className="p-1">
              {searchHistory.map((item) => (
                <div key={item.id} className="group/item flex items-center">
                  <button
                    className="flex flex-1 items-center gap-3 truncate rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    onClick={() => {
                      onSearchChange(item.label);
                      setHistoryOpen(false);
                    }}
                  >
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </button>
                  <button
                    className="p-2 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/item:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.id);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/50 p-0.5">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.days}
              variant={filters.days === p.days ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-6 rounded-md px-2 text-[10px]',
                filters.days === p.days && 'bg-primary text-primary-foreground shadow-sm',
              )}
              onClick={() => onDaysChange(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Category filter */}
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 gap-1 rounded-full text-[11px]',
                filters.categoryId && 'border-primary/50 bg-primary/5 text-primary',
              )}
            >
              <Tag className="h-3 w-3" />
              {filters.categoryName || 'Categoria'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar categoria..."
                value={catSearch}
                onValueChange={setCatSearch}
              />
              <CommandList>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCategoryChange(null, null);
                      setCatOpen(false);
                      setCatSearch('');
                    }}
                  >
                    <span className="text-xs italic text-muted-foreground">
                      Todas as categorias
                    </span>
                  </CommandItem>
                  {filteredCategories.map((cat) => (
                    <CommandItem
                      key={String(cat.id)}
                      value={String(cat.id)}
                      onSelect={() => {
                        onCategoryChange(String(cat.id), cat.name);
                        setCatOpen(false);
                        setCatSearch('');
                      }}
                    >
                      <span
                        className={cn(
                          'w-full text-xs',
                          filters.categoryId === String(cat.id) && 'font-semibold text-primary',
                        )}
                      >
                        {catSearch ? (
                          <HighlightMatch text={cat.name} query={catSearch} />
                        ) : (
                          cat.name
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Supplier filter */}
        <Popover open={supOpen} onOpenChange={setSupOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 gap-1 rounded-full text-[11px]',
                filters.supplierId && 'border-primary/50 bg-primary/5 text-primary',
              )}
            >
              <Filter className="h-3 w-3" />
              {filters.supplierName || 'Fornecedor'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar fornecedor..."
                value={supSearch}
                onValueChange={setSupSearch}
              />
              <CommandList>
                <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onSupplierChange(null, null);
                      setSupOpen(false);
                      setSupSearch('');
                    }}
                  >
                    <span className="text-xs italic text-muted-foreground">
                      Todos os fornecedores
                    </span>
                  </CommandItem>
                  {filteredSuppliers.map((sup) => (
                    <CommandItem
                      key={sup.id}
                      value={sup.id}
                      onSelect={() => {
                        onSupplierChange(sup.id, sup.name);
                        setSupOpen(false);
                        setSupSearch('');
                      }}
                    >
                      <span
                        className={cn(
                          'w-full text-xs',
                          filters.supplierId === sup.id && 'font-semibold text-primary',
                        )}
                      >
                        {supSearch ? (
                          <HighlightMatch text={sup.name} query={supSearch} />
                        ) : (
                          sup.name
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Limit selector */}
        <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
            Top
          </span>
          <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/50 p-0.5">
            {LIMIT_OPTIONS.map((n) => (
              <Button
                key={n}
                variant={filters.limit === n ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-5 rounded-sm px-2 text-[10px]',
                  filters.limit === n &&
                    'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
                )}
                onClick={() => onLimitChange(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        {/* Clear filters */}
        {filters.hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-[10px] text-muted-foreground hover:text-destructive"
            onClick={onClearAll}
          >
            <X className="h-3 w-3" /> Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  );
}

import { Separator } from '@/components/ui/separator';
