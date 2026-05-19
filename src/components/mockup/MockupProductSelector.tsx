/**
 * MockupProductSelector — Product selector for mockup generator
 * 
 * Uses lightweight product loading for the list (no images/variants/colors enrichment),
 * then lazy-loads full product data only when a product is selected.
 * Flow: Search products -> Select product -> Load full data -> Choose color/variant -> Confirmed.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useDebounce } from "@/hooks/common";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Package, X, SearchX, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useProductsCatalog, type ProductLightweight } from "@/hooks/products";
import { type Product } from "@/hooks/products";
import { type ExternalVariantStock } from "@/hooks/products";
import { ProductLoaderAndColorSelector } from "./MockupColorSelector";

export interface MockupProductSelection {
  product: Product;
  variant: ExternalVariantStock | null;
  colorName?: string;
  colorHex?: string;
  /** Image URL to use for the mockup (variant-specific if available) */
  imageUrl: string;
}

interface MockupProductSelectorProps {
  selection: MockupProductSelection | null;
  onSelect: (selection: MockupProductSelection | null) => void;
  disabled?: boolean;
}

export function MockupProductSelector({ selection, onSelect, disabled }: MockupProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 400);
  
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading: isLoadingProducts 
  } = useProductsCatalog({ search: debouncedQuery });

  const products = useMemo(() => data?.pages.flatMap(page => page.products) ?? [], [data]);
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'default' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('default');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Internal state: product picked, loading full data or choosing color
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollParentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollParentRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isFilterPending = searchQuery.length >= 2 && searchQuery !== debouncedQuery;

  const sortedProducts = useMemo(() => {
    if (sortBy === 'default') return products;
    const sorted = [...products];
    switch (sortBy) {
      case 'name-asc': return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc': return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
      default: return sorted;
    }
  }, [products, sortBy]);

  const columnCount = 4; // Max columns as per grid class
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(sortedProducts.length / columnCount),
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 280,
    overscan: 3,
  });

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const isSearching = debouncedQuery.length >= 2;
  const resultCount = sortedProducts.length;

  const handleProductPick = (product: ProductLightweight) => {
    setPendingProductId(product.id);
    setSearchQuery("");
  };

  const handleColorSelect = (variant: ExternalVariantStock | null, product: Product) => {
    const variantThumb = variant?.selected_thumbnail
      ? `${variant.selected_thumbnail}/thumbnail`
      : null;
    const variantFirstImg = variant?.images?.[0]
      ? `${variant.images[0]}/thumbnail`
      : null;
    const imageUrl = variantThumb || variantFirstImg || product.images?.[0] || '/placeholder.svg';
    
    onSelect({
      product,
      variant,
      colorName: variant?.color_name ?? undefined,
      colorHex: variant?.color_hex ?? undefined,
      imageUrl,
    });
    setPendingProductId(null);
    setIsDialogOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setPendingProductId(null);
    setSearchQuery("");
  };

  // ─── State: Product + Color confirmed ──────────────────────────────
  if (selection) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card">
        <div className="w-11 h-11 rounded-lg bg-muted overflow-hidden shrink-0">
          <img
            src={selection.imageUrl}
            alt={selection.product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.includes('/thumbnail')) {
                t.src = t.src.replace('/thumbnail', '');
              } else if (selection.product.images?.[0]) {
                t.src = selection.product.images[0];
              } else {
                t.src = '/placeholder.svg';
              }
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate text-sm">{selection.product.name}</h4>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono tracking-wide">
              {selection.product.sku || 'N/A'}
            </span>
            {selection.colorName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                {selection.colorHex && (
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-border/50"
                    style={{ backgroundColor: selection.colorHex }}
                  />
                )}
                {selection.colorName}
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  // ─── State: Product picked, loading full data + choosing color ─────
  if (pendingProductId) {
    return (
      <ProductLoaderAndColorSelector
        productId={pendingProductId}
        onSelect={handleColorSelect}
        onBack={() => setPendingProductId(null)}
      />
    );
  }

  // ─── State: Product list (search) ──────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-24 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 group flex flex-col gap-2 transition-all duration-300 rounded-xl"
            disabled={disabled}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Buscar produto</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Por nome, SKU ou categoria</span>
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-border/40 shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-2xl font-display">
              <Package className="h-6 w-6 text-primary" />
              Selecione o Produto
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-[70vh]">
            {/* Search Header */}
            <div className="p-6 pt-2 space-y-4 shrink-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Busque por nome, SKU ou palavras-chave..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-12 h-14 text-base border-primary/20 bg-muted/20 focus-visible:ring-primary/20 rounded-xl"
                  autoFocus
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4">
                  <p className="text-xs text-muted-foreground font-medium">
                    {isLoadingProducts
                      ? 'Carregando catálogo...'
                      : isSearching
                        ? `${resultCount} resultado${resultCount !== 1 ? 's' : ''}`
                        : `${products.length} produtos em destaque`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="text-xs border-none bg-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium focus:ring-0"
                  >
                    <option value="default">Relevância</option>
                    <option value="name-asc">Nome A→Z</option>
                    <option value="name-desc">Nome Z→A</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 min-h-0 bg-muted/10 border-t border-border/30">
              <div
                ref={scrollParentRef}
                className="h-full overflow-auto px-6 py-4"
                onScroll={handleScroll}
              >
                {isLoadingProducts || isFilterPending ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="space-y-3 p-3 rounded-2xl border border-border/30 bg-card">
                        <Skeleton className="aspect-square w-full rounded-xl" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : sortedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                      <SearchX className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="font-display text-xl font-bold text-foreground">Nenhum resultado</p>
                    <p className="text-sm mt-1">Tente usar termos mais genéricos ou outro SKU.</p>
                    <Button variant="link" className="mt-2" onClick={() => setSearchQuery("")}>Limpar busca</Button>
                  </div>
                ) : (
                  <div 
                    className="relative w-full" 
                    style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const startIndex = virtualRow.index * columnCount;
                      const rowItems = sortedProducts.slice(startIndex, startIndex + columnCount);
                      
                      return (
                        <div
                          key={virtualRow.key}
                          className="absolute top-0 left-0 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {rowItems.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => handleProductPick(product)}
                              className="group relative flex flex-col p-3 rounded-2xl border border-border/30 bg-card hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary outline-none"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && handleProductPick(product)}
                            >
                              <div className="aspect-square rounded-xl bg-muted overflow-hidden mb-3 relative">
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                                />
                                <div className="absolute top-2 right-2 flex flex-col gap-1">
                                   {product.stock > 0 ? (
                                    <Badge className="bg-success/90 hover:bg-success text-[9px] px-1.5 py-0 border-none shadow-sm">
                                      {product.stock >= 1000 ? `${(product.stock / 1000).toFixed(1)}k` : product.stock} un
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 border-none shadow-sm">Esgotado</Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex-1 flex flex-col min-w-0">
                                <h4 className="font-semibold text-sm leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                  {product.name}
                                </h4>
                                <div className="mt-auto flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">
                                    {product.sku}
                                  </span>
                                  <p className="text-sm font-bold text-foreground tabular-nums">
                                    {formatCurrency(product.price)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-export from extracted module
export { ProductLoaderAndColorSelector } from "./MockupColorSelector";