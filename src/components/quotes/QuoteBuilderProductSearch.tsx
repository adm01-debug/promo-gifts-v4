/**
 * QuoteBuilderProductSearch — Dialog de busca e seleção de produtos
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Package, PackageCheck, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { QuoteProductColorSelector } from '@/components/quotes/QuoteProductColorSelector';
import type { ExternalVariantStock } from '@/hooks/products';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[] | null;
  colors?: { name: string; hex?: string; stock?: number }[];
  totalStock?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productSearch: string;
  setProductSearch: (v: string) => void;
  filteredProducts: Product[];
  selectedProductForColor: Product | null;
  setSelectedProductForColor: (p: Product | null) => void;
  onProductClick: (p: Product) => void;
  onAddWithColor: (p: Product, v: ExternalVariantStock | null) => void;
  formatCurrency: (v: number) => string;
}

export function QuoteBuilderProductSearch({
  open,
  onOpenChange,
  productSearch,
  setProductSearch,
  filteredProducts,
  selectedProductForColor,
  setSelectedProductForColor,
  onProductClick,
  onAddWithColor,
  formatCurrency,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setSelectedProductForColor(null);
          setProductSearch('');
        }
      }}
    >
      {/*
        Larguras responsivas — redução de ~20% vs. o `max-w-2xl` original (42rem).
        - mobile (<640px):   w-[calc(100vw-2rem)]   → respeita gutter de 1rem em cada lado
        - sm (≥640px):       max-w-[28rem]          (~448px, –22% vs 36rem original do sm)
        - md (≥768px):       max-w-[30rem]          (~480px)
        - lg (≥1024px):      max-w-[33.6rem]        (~537px, exatamente –20% de 42rem)
      */}
      <DialogContent
        data-testid="quote-add-product-modal"
        className="flex max-h-[85vh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-[28rem] md:max-w-[30rem] lg:max-w-[33.6rem]"
      >

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-base font-semibold">
                {selectedProductForColor ? 'Selecionar Cor' : 'Adicionar Produto'}
              </span>
              <p className="text-xs font-normal text-muted-foreground">
                {selectedProductForColor
                  ? 'Escolha a cor desejada para adicionar ao orçamento'
                  : 'Busque e selecione um produto para o orçamento'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {selectedProductForColor ? (
            <QuoteProductColorSelector
              product={selectedProductForColor}
              onSelect={(variant) => onAddWithColor(selectedProductForColor, variant)}
              onBack={() => setSelectedProductForColor(null)}
            />
          ) : (
            <>
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="product-search-input"
                  placeholder="Buscar por nome ou SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-11 border-primary/30 pl-10 text-sm focus-visible:ring-primary/20"
                  autoFocus
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}{' '}
                disponíve{filteredProducts.length !== 1 ? 'is' : 'l'}
              </p>
              <div className="-mx-1 max-h-[50vh] overflow-y-auto px-1">
                {filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">Nenhum produto encontrado</p>
                    {productSearch && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setProductSearch('')}
                      >
                        Limpar busca
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredProducts.map((product) => {
                      const stock = product.totalStock ?? 0;
                      const isOutOfStock = stock === 0;
                      const isLowStock = stock > 0 && stock < 100;
                      const formatStock = (qty: number) =>
                        qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString();
                      return (
                        <button
                          key={product.id}
                          data-testid={`product-search-option-${product.id}`}
                          onClick={() => onProductClick(product)}
                          className={cn(
                            'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                            isOutOfStock
                              ? 'border-destructive/20 bg-destructive/5 opacity-75'
                              : isLowStock
                                ? 'border-warning/20 hover:bg-accent/60'
                                : 'border-transparent hover:bg-accent/60',
                          )}
                        >
                          <div className="relative shrink-0">
                            {product.images && product.images.length > 0 ? (
                              <img
                                loading="lazy"
                                src={getCdnUrl(product.images[0], 'thumbnail')}
                                alt={product.name}
                                className="h-11 w-11 rounded-lg bg-muted object-cover transition-opacity duration-300"
                                onLoad={(e) => e.currentTarget.classList.add('opacity-100')}
                                onError={(e) => {
                                  const t = e.currentTarget;
                                  if (t.src.includes('/thumbnail'))
                                    t.src = product.images?.[0] ?? '';
                                  else t.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            {isOutOfStock && (
                              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive">
                                <X className="h-2.5 w-2.5 text-destructive-foreground" />
                              </div>
                            )}
                            {isLowStock && (
                              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning">
                                <AlertTriangle className="h-2.5 w-2.5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {product.sku}
                              </span>
                              {product.colors && product.colors.length > 0 && (
                                <div className="flex items-center gap-0.5">
                                  {product.colors.slice(0, 5).map((c, i) => (
                                    <div
                                      key={i}
                                      className="h-2.5 w-2.5 rounded-full border border-border/50"
                                      style={{ backgroundColor: c.hex || '#CCC' }}
                                      title={c.name}
                                    />
                                  ))}
                                  {product.colors.length > 5 && (
                                    <span className="ml-0.5 text-[9px] text-muted-foreground">
                                      +{product.colors.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 space-y-0.5 pl-2 text-right">
                            <p className="text-sm font-semibold tabular-nums text-primary">
                              {formatCurrency(product.price)}
                            </p>
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Estoque zerado
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {formatStock(stock)} un
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <PackageCheck className="h-2.5 w-2.5 text-success" />
                                {formatStock(stock)} un
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
