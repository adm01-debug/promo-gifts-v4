import { useState, useMemo } from "react";
import { Search, Filter, ChevronDown, X, Tag, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSearchHistory } from "@/hooks/common";
import { cn } from "@/lib/utils";

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export { HighlightMatch };

const PERIOD_OPTIONS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "1 ano", days: 360 },
];

const LIMIT_OPTIONS = [10, 20, 30, 50];

interface Supplier { id: string; name: string }
interface Category { id: string | number; name: string }

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
  const [supSearch, setSupSearch] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { history: searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory("general");

  const filteredSuppliers = useMemo(() => {
    if (!supSearch.trim()) return suppliers;
    const q = supSearch.toLowerCase().trim();
    return suppliers.filter(s => s.name.toLowerCase().includes(q));
  }, [suppliers, supSearch]);

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const handleSearchSubmit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    
    onSearchChange(trimmed);
    if (trimmed.length >= 2) {
      addToHistory({
        id: `search-${trimmed}`,
        label: trimmed,
        type: "general"
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
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder='Ex: "squeeze metal", "caneta", "mochila"...'
                value={filters.searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (!historyOpen && searchHistory.length > 0) setHistoryOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchSubmit(filters.searchTerm);
                  }
                }}
                className="pl-9 h-10 text-sm bg-background border-muted-foreground/20 focus-visible:ring-primary/20"
              />
              {filters.searchTerm && (
                <button 
                  aria-label="Limpar busca"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Histórico de Busca
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] px-2 hover:text-destructive transition-colors"
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
                <div 
                  key={item.id}
                  className="flex items-center group/item"
                >
                  <button
                    className="flex-1 flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent rounded-md transition-colors truncate"
                    onClick={() => {
                      onSearchChange(item.label);
                      setHistoryOpen(false);
                    }}
                  >
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </button>
                  <button
                    className="p-2 text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-all"
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
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/50">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.days}
              variant={filters.days === p.days ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-6 text-[10px] px-2 rounded-md",
                filters.days === p.days && "bg-primary shadow-sm text-primary-foreground"
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
                "h-7 gap-1 text-[11px] rounded-full",
                filters.categoryId && "border-primary/50 bg-primary/5 text-primary"
              )}
            >
              <Tag className="h-3 w-3" />
              {filters.categoryName || "Categoria"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Buscar categoria..." value={catSearch} onValueChange={setCatSearch} />
              <CommandList>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { onCategoryChange(null, null); setCatOpen(false); setCatSearch(""); }}>
                    <span className="text-muted-foreground italic text-xs">Todas as categorias</span>
                  </CommandItem>
                  {filteredCategories.map((cat) => (
                    <CommandItem
                      key={String(cat.id)}
                      value={String(cat.id)}
                      onSelect={() => { onCategoryChange(String(cat.id), cat.name); setCatOpen(false); setCatSearch(""); }}
                    >
                      <span className={cn("text-xs w-full", filters.categoryId === String(cat.id) && "font-semibold text-primary")}>
                        {catSearch ? <HighlightMatch text={cat.name} query={catSearch} /> : cat.name}
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
                "h-7 gap-1 text-[11px] rounded-full",
                filters.supplierId && "border-primary/50 bg-primary/5 text-primary"
              )}
            >
              <Filter className="h-3 w-3" />
              {filters.supplierName || "Fornecedor"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Buscar fornecedor..." value={supSearch} onValueChange={setSupSearch} />
              <CommandList>
                <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { onSupplierChange(null, null); setSupOpen(false); setSupSearch(""); }}>
                    <span className="text-muted-foreground italic text-xs">Todos os fornecedores</span>
                  </CommandItem>
                  {filteredSuppliers.map((sup) => (
                    <CommandItem
                      key={sup.id}
                      value={sup.id}
                      onSelect={() => { onSupplierChange(sup.id, sup.name); setSupOpen(false); setSupSearch(""); }}
                    >
                      <span className={cn("text-xs w-full", filters.supplierId === sup.id && "font-semibold text-primary")}>
                        {supSearch ? <HighlightMatch text={sup.name} query={supSearch} /> : sup.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Limit selector */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Top</span>
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5 border border-border/50">
            {LIMIT_OPTIONS.map((n) => (
              <Button
                key={n}
                variant={filters.limit === n ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-5 text-[10px] px-2 rounded-sm",
                  filters.limit === n && "bg-primary shadow-sm text-primary-foreground hover:bg-primary/90"
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
            className="h-7 text-[10px] text-muted-foreground hover:text-destructive gap-1 ml-auto"
            onClick={onClearAll}
          >
            <X className="h-3 w-3" /> Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  );
}

import { Separator } from "@/components/ui/separator";
