import { useState, useMemo } from 'react';
import { useExternalProductSearch } from '@/hooks/simulation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Package, X } from 'lucide-react';
import { formatCurrency } from './utils';
import { TruncatedTooltip } from '@/components/ui/truncated-tooltip';
import type { Product } from './types';

interface ProductSearchProps {
  onSelect: (product: Product | null) => void;
  selectedProduct: Product | null;
}

export function ProductSearch({ onSelect, selectedProduct }: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: externalProducts, isLoading } = useExternalProductSearch(searchQuery);

  // Mapear produtos externos para o formato interno
  const mappedProducts = useMemo(() => {
    if (!externalProducts) return [];
    return externalProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.sale_price ?? 0,
      images: p.images || (p.primary_image_url ? [p.primary_image_url] : []),
      category_name: null,
      supplier_reference: p.supplier_reference,
      brand: p.brand,
    }));
  }, [externalProducts]);

  const products = useMemo(() => {
    if (!mappedProducts.length) return [];
    return mappedProducts;
  }, [mappedProducts]);

  if (selectedProduct && !isSearching) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {selectedProduct.images?.[0] ? (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <TruncatedTooltip className="font-medium">{selectedProduct.name}</TruncatedTooltip>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>SKU: {selectedProduct.sku}</span>
                <span>•</span>
                <span className="font-medium text-primary">
                  {formatCurrency(selectedProduct.price)}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            onClick={() => {
              onSelect(null);
              setIsSearching(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto por nome ou SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!!products?.length && (
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  onSelect(product);
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <TruncatedTooltip className="font-medium">{product.name}</TruncatedTooltip>
                  <p className="text-xs text-muted-foreground">
                    {product.sku} • {formatCurrency(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {searchQuery.length >= 2 && products?.length === 0 && !isLoading && (
        <div className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
