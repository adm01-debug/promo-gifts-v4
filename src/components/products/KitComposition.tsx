import { useState, useMemo } from 'react';
import {
  Package,
  Palette,
  Weight,
  Layers,
  BoxSelect,
  ShoppingBag,
  ChevronUp,
  ChevronDown,
  Box,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { KitComponent } from '@/types/product-catalog';
import { KitComponentCard } from './kit-composition/KitComponentCard';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

interface KitCompositionProps {
  items: KitComponent[];
  onViewProduct?: (productId: string) => void;
}

export function KitComposition({ items, onViewProduct }: KitCompositionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({ packaging: true, products: true });

  const stats = useMemo(() => {
    const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalWeight = items.reduce((sum, item) => sum + (item.weightG ?? 0) * item.quantity, 0);
    const packagingCount = items.filter((i) => i.isPackaging).length;
    const productCount = items.filter((i) => !i.isPackaging).length;
    const personalizableCount = items.filter((i) => i.allowsPersonalization).length;
    return { totalPieces, totalWeight, packagingCount, productCount, personalizableCount };
  }, [items]);

  const formatWeight = (grams: number) =>
    grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;

  const packagingItems = items.filter((i) => i.isPackaging);
  const productItems = items.filter((i) => !i.isPackaging);

  return (
    <>
      {/* Trigger Card */}
      <div
        className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/40"
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setDialogOpen(true)}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-display text-base font-semibold text-foreground">
                Composição do Kit
              </h3>
              <span className="text-xs text-muted-foreground">
                {items.length} componentes • {stats.totalPieces} peças
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden -space-x-2 sm:flex">
              {items.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border-2 border-card bg-muted"
                >
                  {item.imageUrl ? (
                    <OptimizedImage
                      src={getCdnUrl(item.imageUrl, 'thumbnail')}
                      alt=""
                      className="object-contain p-0.5"
                      containerClassName="h-full w-full"
                    />
                  ) : (
                    <Package className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </div>
              ))}
              {items.length > 4 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground">
                  +{items.length - 4}
                </div>
              )}
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
        </div>
      </div>

      {/* Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[72vh] gap-0 overflow-hidden p-0 sm:max-w-[540px]">
          <DialogHeader className="space-y-3 border-b border-border px-6 pb-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Composição do Kit</DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? 'componente' : 'componentes'} •{' '}
                  {stats.totalPieces} {stats.totalPieces === 1 ? 'peça' : 'peças'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stats.productCount > 0 && (
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                  <ShoppingBag className="h-3 w-3" />
                  {stats.productCount} {stats.productCount === 1 ? 'item' : 'itens'}
                </Badge>
              )}
              {stats.packagingCount > 0 && (
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                  <BoxSelect className="h-3 w-3" />
                  {stats.packagingCount} {stats.packagingCount === 1 ? 'embalagem' : 'embalagens'}
                </Badge>
              )}
              {stats.personalizableCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/30 px-2.5 py-1 text-xs text-primary"
                >
                  <Palette className="h-3 w-3" />
                  {stats.personalizableCount} personalizáveis
                </Badge>
              )}
              {stats.totalWeight > 0 && (
                <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
                  <Weight className="h-3 w-3" />
                  {formatWeight(stats.totalWeight)} total
                </Badge>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(72vh-160px)]">
            <div className="space-y-5 px-6 py-4">
              {/* Nota informativa: kits nativos são vendidos como conjunto único. */}
              <div
                role="note"
                className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Este kit é vendido como{' '}
                  <strong className="text-foreground">conjunto único</strong> pelo fornecedor. Os
                  componentes abaixo são informativos — não estão disponíveis para compra avulsa.
                </span>
              </div>

              {packagingItems.length > 0 && (
                <Collapsible
                  open={expandedSections.packaging}
                  onOpenChange={(open) => setExpandedSections((s) => ({ ...s, packaging: open }))}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5 transition-colors hover:bg-warning/10">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning dark:text-warning">
                      <Box className="h-3.5 w-3.5" />
                      Embalagem ({packagingItems.length})
                    </span>
                    {expandedSections.packaging ? (
                      <ChevronUp className="h-4 w-4 text-warning dark:text-warning" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-warning dark:text-warning" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-3">
                      {packagingItems.map((item, idx) => (
                        <KitComponentCard
                          key={item.id}
                          item={item}
                          index={idx + 1}
                          variant="packaging"
                          onViewProduct={onViewProduct}
                          onZoomImage={(url) => setZoomImageUrl(url)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {productItems.length > 0 && (
                <Collapsible
                  open={expandedSections.products}
                  onOpenChange={(open) => setExpandedSections((s) => ({ ...s, products: open }))}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Itens do Kit ({productItems.length})
                    </span>
                    {expandedSections.products ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-3">
                      {productItems.map((item, idx) => (
                        <KitComponentCard
                          key={item.id}
                          item={item}
                          index={idx + 1}
                          variant="item"
                          onViewProduct={onViewProduct}
                          onZoomImage={(url) => setZoomImageUrl(url)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}>
        <DialogContent className="max-w-2xl bg-background/95 p-2 backdrop-blur-xl">
          {zoomImageUrl && (
            <img
              src={zoomImageUrl}
              alt="Zoom"
              className="h-auto max-h-[80vh] w-full rounded-lg object-contain"
              loading="lazy"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
