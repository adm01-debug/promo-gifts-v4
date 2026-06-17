import { useState, useMemo } from 'react';
import { Filter, X, ChevronDown, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCategories, useProductsLightweight, useSuppliers } from '@/hooks/products';
import { cn } from '@/lib/utils';

export interface IntelligenceFilters {
  days: number;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  productId: string | null;
  productName: string | null;
}

interface IntelligenceFilterBarProps {
  filters: IntelligenceFilters;
  onFiltersChange: (filters: IntelligenceFilters) => void;
}

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '120d', days: 120 },
  { label: '150d', days: 150 },
  { label: '180d', days: 180 },
  { label: '1 ano', days: 360 },
];

/** Highlights matching portions of text */
function HighlightText({ text, query }: { text: string; query: string }) {
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

export function IntelligenceFilterBar({ filters, onFiltersChange }: IntelligenceFilterBarProps) {
  const { data: categories = [] } = useCategories();
  const { suppliers } = useSuppliers();
  const { data: products = [] } = useProductsLightweight();
  const [catOpen, setCatOpen] = useState(false);
  const [supOpen, setSupOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [supSearch, setSupSearch] = useState('');

  const activeFilterCount =
    (filters.categoryId ? 1 : 0) + (filters.supplierId ? 1 : 0) + (filters.productId ? 1 : 0);

  const clearAll = () => {
    onFiltersChange({
      ...filters,
      categoryId: null,
      categoryName: null,
      supplierId: null,
      supplierName: null,
      productId: null,
      productName: null,
    });
  };

  const filteredProducts = useMemo(() => {
    if (!prodSearch.trim()) return products.slice(0, 50);
    const q = prodSearch.toLowerCase().trim();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [products, prodSearch]);

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const filteredSuppliers = useMemo(() => {
    if (!supSearch.trim()) return suppliers;
    const q = supSearch.toLowerCase().trim();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supSearch]);

  return (
    <div className="space-y-3">
      {/* Period + Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period pills */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-1">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.days}
              variant={filters.days === p.days ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 shrink-0 rounded-lg px-2.5 text-xs transition-all',
                filters.days === p.days && 'bg-primary shadow-sm',
              )}
              onClick={() => onFiltersChange({ ...filters, days: p.days })}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Category Filter */}
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5 text-xs',
                filters.categoryId && 'border-primary/50 bg-primary/5 text-primary',
              )}
            >
              <Filter className="h-3 w-3" />
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
                      onFiltersChange({ ...filters, categoryId: null, categoryName: null });
                      setCatOpen(false);
                      setCatSearch('');
                    }}
                  >
                    <span className="text-muted-foreground">Todas as categorias</span>
                  </CommandItem>
                  {filteredCategories.map((cat) => (
                    <CommandItem
                      key={String(cat.id)}
                      value={String(cat.id)}
                      onSelect={() => {
                        onFiltersChange({
                          ...filters,
                          categoryId: String(cat.id),
                          categoryName: cat.name,
                        });
                        setCatOpen(false);
                        setCatSearch('');
                      }}
                    >
                      <span
                        className={cn(
                          filters.categoryId === String(cat.id) && 'font-semibold text-primary',
                        )}
                      >
                        <HighlightText text={cat.name} query={catSearch} />
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Supplier Filter */}
        <Popover open={supOpen} onOpenChange={setSupOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5 text-xs',
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
                      onFiltersChange({ ...filters, supplierId: null, supplierName: null });
                      setSupOpen(false);
                      setSupSearch('');
                    }}
                  >
                    <span className="text-muted-foreground">Todos os fornecedores</span>
                  </CommandItem>
                  {filteredSuppliers.map((sup) => (
                    <CommandItem
                      key={sup.id}
                      value={sup.id}
                      onSelect={() => {
                        onFiltersChange({ ...filters, supplierId: sup.id, supplierName: sup.name });
                        setSupOpen(false);
                        setSupSearch('');
                      }}
                    >
                      <span
                        className={cn(
                          filters.supplierId === sup.id && 'font-semibold text-primary',
                        )}
                      >
                        <HighlightText text={sup.name} query={supSearch} />
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Product Filter */}
        <Popover open={prodOpen} onOpenChange={setProdOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5 text-xs',
                filters.productId && 'border-primary/50 bg-primary/5 text-primary',
              )}
            >
              <Package className="h-3 w-3" />
              {filters.productName
                ? filters.productName.length > 20
                  ? `${filters.productName.slice(0, 20)}…`
                  : filters.productName
                : 'Produto'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar produto por nome ou SKU..."
                value={prodSearch}
                onValueChange={setProdSearch}
              />
              <CommandList className="max-h-72">
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <Search className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">Nenhum produto encontrado</p>
                    <p className="text-xs">Tente outro termo de busca</p>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onFiltersChange({ ...filters, productId: null, productName: null });
                      setProdOpen(false);
                      setProdSearch('');
                    }}
                  >
                    <span className="text-muted-foreground">Todos os produtos</span>
                  </CommandItem>
                  {filteredProducts.map((prod) => (
                    <CommandItem
                      key={prod.id}
                      value={prod.id}
                      onSelect={() => {
                        onFiltersChange({ ...filters, productId: prod.id, productName: prod.name });
                        setProdOpen(false);
                        setProdSearch('');
                      }}
                      className="flex items-center gap-2.5 py-2"
                    >
                      {/* Thumbnail */}
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                        {prod.image_url && prod.image_url !== '/placeholder.svg' ? (
                          <img
                            src={prod.image_url}
                            alt="Imagem do produto"
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {/* Name + SKU with highlight */}
                      <div
                        className={cn(
                          'flex min-w-0 flex-1 flex-col',
                          filters.productId === prod.id && 'font-semibold text-primary',
                        )}
                      >
                        <span className="truncate text-sm">
                          <HighlightText text={prod.name} query={prodSearch} />
                        </span>
                        {prod.sku && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            <HighlightText text={prod.sku} query={prodSearch} />
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                  {prodSearch && filteredProducts.length >= 50 && (
                    <div className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                      Mostrando 50 resultados · refine sua busca
                    </div>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Active filter count + clear */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={clearAll}
          >
            <X className="h-3 w-3" />
            Limpar filtros
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {activeFilterCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.productName && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 px-2 py-0.5 text-xs"
            >
              Produto: {filters.productName}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => onFiltersChange({ ...filters, productId: null, productName: null })}
              />
            </Badge>
          )}
          {filters.categoryName && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 px-2 py-0.5 text-xs"
            >
              Categoria: {filters.categoryName}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() =>
                  onFiltersChange({ ...filters, categoryId: null, categoryName: null })
                }
              />
            </Badge>
          )}
          {filters.supplierName && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 px-2 py-0.5 text-xs"
            >
              Fornecedor: {filters.supplierName}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() =>
                  onFiltersChange({ ...filters, supplierId: null, supplierName: null })
                }
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
