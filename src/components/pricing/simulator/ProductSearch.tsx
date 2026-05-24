import { useState, useMemo } from 'react';
import { useExternalProductSearch } from '@/hooks/simulation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Package, X } from 'lucide-react';
import { formatCurrency } from './utils';
import type { Product } from "./types";

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
      price: p.sale_price ?? p.base_price ?? 0,
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
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {selectedProduct.images?.[0] ? (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">{selectedProduct.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>SKU: {selectedProduct.sku}</span>
                <span>•</span>
                <span className="text-primary font-medium">
                  {formatCurrency(selectedProduct.price)}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon" aria-label="Fechar"
            onClick={() => {
              onSelect(null);
              setIsSearching(true);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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

      {products && products.length > 0 && (
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
                className="w-full p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
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
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
