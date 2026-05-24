/**
 * StepProduct - Passo 1: Seleção de Produto + Quantidade
 * 
 * Design: Layout premium com virtualização para 15k+ produtos
 */

import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Search,
  X,
  ChevronRight,
  Sparkles,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useExternalProductSearch } from '@/hooks/simulation';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { ProductColorGrid } from './ProductColorGrid';
import { useWizardDrafts } from '@/hooks/simulator/useWizardDrafts';
import { formatCurrency } from '@/lib/format';

interface StepProductProps {
  wizard: UseSimulatorWizardReturn;
}

const QUANTITY_PRESETS = [50, 100, 250, 500, 1000];

export function StepProduct({ wizard }: StepProductProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { drafts } = useWizardDrafts();

  // Server-side search — same parallel prefix+broad pattern as the quote builder
  const { data: externalProducts, isLoading } = useExternalProductSearch(searchTerm);

  // Map external products to the format StepProduct expects
  const filteredProducts = useMemo(() => {
    if (!externalProducts || externalProducts.length === 0) return [];
    return externalProducts.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.sale_price ?? 0,
      imageUrl: p.primary_image_url || p.image_url || (p.images?.[0] ?? null),
      category_name: null as string | null,
      categoryName: null as string | null,
      brand: p.brand || null,
      colors: [] as Array<{ name: string; hex: string; code?: string; sku?: string; stock?: number; image?: string }>,
    }));
  }, [externalProducts]);

  // formatCurrency imported from @/lib/format

  const handleSelectProduct = (product: typeof filteredProducts[0]) => {
    wizard.selectProduct({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      imageUrl: product.imageUrl,
      categoryName: product.categoryName,
      brand: product.brand,
      colors: product.colors,
    });
  };
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer for large product lists
  const ITEM_HEIGHT = 100;
  const ROW_GAP = 12;
  const COLUMNS = 3;
  const rowCount = Math.ceil(filteredProducts.length / COLUMNS);
  
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT + ROW_GAP,
    overscan: 5,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Row: Quantity + Header inline */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
        {/* Quantity Section - compact inline */}
        <div className="p-4 rounded-2xl bg-card border flex items-center gap-4 shrink-0">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Quantidade
          </h4>
          <div className="flex gap-1.5">
            {QUANTITY_PRESETS.map(qty => (
              <Button
                key={qty}
                variant={wizard.quantity === qty ? 'default' : 'outline'}
                size="sm"
                onClick={() => wizard.setQuantity(qty)}
                className={cn(
                  'min-w-[44px] rounded-xl h-9',
                  wizard.quantity === qty && 'shadow-lg shadow-primary/20'
                )}
              >
                {qty >= 1000 ? `${qty / 1000}k` : qty}
              </Button>
            ))}
          </div>
          <Input
            type="number"
            value={wizard.quantity}
            onChange={e => wizard.setQuantity(parseInt(e.target.value) || 1)}
            min={1}
            className="text-center text-lg font-bold h-9 w-24 rounded-xl"
          />
        </div>

        {/* Section Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Escolha o Produto</h3>
            <p className="text-muted-foreground text-sm">Busque pelo nome, SKU ou categoria</p>
          </div>
        </div>
      </div>

      {/* Recent Drafts */}
      {!wizard.selectedProduct && drafts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Recentes:</span>
          {drafts.slice(0, 4).map((draft) => (
            <Button
              key={draft.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 shrink-0 rounded-lg"
              onClick={() => {
                if (draft.product_data) {
                  wizard.selectProduct(draft.product_data);
                  wizard.setQuantity(draft.quantity);
                }
              }}
            >
              <span className="truncate max-w-[120px]">{draft.title}</span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{draft.quantity}un</Badge>
            </Button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, SKU ou categoria..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 pr-12 h-14 text-base rounded-2xl bg-muted/30 border-0 focus-visible:ring-2 focus-visible:ring-primary/40 shadow-sm"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon" aria-label="Fechar"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>


      {/* Results count */}
      {!isLoading && searchTerm.trim().length >= 2 && (
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} produtos encontrados
          {searchTerm && <span> para "<span className="font-semibold">{searchTerm}</span>"</span>}
        </p>
      )}

      {/* Products Grid - Virtualized */}
      <div ref={parentRef} className="h-[520px] overflow-auto pr-2 rounded-xl" style={{ contain: 'strict' }}>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : searchTerm.trim().length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 mb-5">
              <Search className="h-12 w-12 text-primary/40" />
            </div>
            <p className="font-display font-semibold text-xl text-foreground mb-1">Escolha o produto</p>
            <p className="text-sm mb-6 max-w-xs text-center">Busque pelo nome, SKU ou categoria para iniciar a simulação de preços</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Caneta", "Caderno", "Camiseta", "Garrafa", "Mochila"].map(tip => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('[data-simulator-search]');
                    if (input) {
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                      nativeInputValueSetter?.call(input, tip);
                      input.dispatchEvent(new Event('input', { bubbles: true }));
                      input.focus();
                    }
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-all"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Package className="h-10 w-10 opacity-30" />
            </div>
            <p className="font-semibold text-lg">Nenhum produto encontrado</p>
            <p className="text-sm mt-1">Tente outro termo de busca</p>
          </div>
        ) : (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIdx = virtualRow.index * COLUMNS;
              const rowProducts = filteredProducts.slice(startIdx, startIdx + COLUMNS);

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${ITEM_HEIGHT}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: `${ROW_GAP}px`,
                  }}
                >
                  {rowProducts.map((product) => {
                    const isSelected = wizard.selectedProduct?.id === product.id;
                    
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={cn(
                          'w-full p-4 rounded-2xl text-left transition-all duration-200',
                          'flex items-center gap-4 group',
                          isSelected 
                            ? 'bg-primary/10 ring-2 ring-primary shadow-lg shadow-primary/10'
                            : 'bg-card hover:bg-muted/60 hover:shadow-md border border-transparent hover:border-border/50'
                        )}
                      >
                        {/* Image */}
                        <div className={cn(
                          'w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden transition-transform',
                          'bg-gradient-to-br from-muted to-muted/50',
                          'group-hover:scale-105'
                        )}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-2 leading-tight">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] font-mono h-5">
                              {product.sku}
                            </Badge>
                          </div>
                        </div>

                        {/* Price & Check */}
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-primary">
                            {formatCurrency(product.price)}
                          </p>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-1 ml-auto">
                              <Sparkles className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom CTA - only when product selected */}
      {wizard.selectedProduct && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Color variants */}
          {wizard.selectedProduct.colors && wizard.selectedProduct.colors.length > 0 && (
            <div className="p-4 rounded-2xl bg-card border">
              <ProductColorGrid colors={wizard.selectedProduct.colors} />
            </div>
          )}

          {/* CTA bar */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden">
                {wizard.selectedProduct.imageUrl ? (
                  
<img src={wizard.selectedProduct.imageUrl} alt="" className="w-full h-full object-cover"  loading="lazy"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-sm line-clamp-1">{wizard.selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground">
                  {wizard.quantity} un. × {formatCurrency(wizard.effectivePrice)} = <span className="font-bold text-primary">{formatCurrency(wizard.effectivePrice * wizard.quantity)}</span>
                </p>
              </div>
            </div>
            <Button
              className="h-12 px-8 text-base gap-2 rounded-2xl shadow-lg shadow-primary/20"
              size="lg"
              disabled={!wizard.canProceed}
              onClick={wizard.nextStep}
            >
              Continuar
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
