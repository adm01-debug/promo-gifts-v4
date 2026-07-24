/**
 * ProductPreviewPanel — Preview em tempo real de como o produto aparece no catálogo
 * Espelha o layout do ProductCard do catálogo, usando dados do formulário via watch()
 */

import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { Eye, Package, Sparkles, Layers, Building2, ImageIcon } from 'lucide-react';

interface ProductPreviewPanelProps {
  name: string;
  sku: string;
  salePrice: number;
  stockQuantity: number;
  images: string[];
  brand: string;
  isFeatured: boolean;
  isNew: boolean;
  isOnSale: boolean;
  isKit: boolean;
  isActive: boolean;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

const getStockStatus = (qty: number) => {
  if (qty <= 0) return { label: 'Estoque zerado', color: 'text-destructive' };
  if (qty <= 10) return { label: 'Estoque baixo', color: 'text-warning' };
  return { label: 'Em estoque', color: 'text-success' };
};

export const ProductPreviewPanel = memo(
  ({
    name,
    sku,
    salePrice,
    stockQuantity,
    images,
    brand,
    isFeatured,
    isNew,
    isOnSale,
    isKit,
    isActive,
  }: ProductPreviewPanelProps) => {
    const imageUrl = images[0] ? getCdnUrl(images[0], 'card') : null;
    const stock = getStockStatus(stockQuantity);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview do Catálogo
          </span>
        </div>

        {/* Card preview */}
        <Card
          className={cn(
            'overflow-hidden border-border/50 bg-card transition-all duration-300',
            !isActive && 'opacity-50 grayscale',
            isFeatured && 'shadow-lg ring-2 ring-primary/20',
          )}
        >
          {/* Image */}
          <div className="relative aspect-[4/5] overflow-hidden bg-muted/30">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name || 'Produto'}
                className="h-full w-full object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
                <ImageIcon className="h-10 w-10" />
                <span className="text-[10px] font-medium">Sem imagem</span>
              </div>
            )}

            {/* Featured glow */}
            {isFeatured && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
            )}

            {/* Badges */}
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              {isFeatured && (
                <Badge className="bg-gradient-to-r from-primary to-primary-glow px-1.5 py-0.5 text-[10px] text-primary-foreground shadow-lg">
                  <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                  Destaque
                </Badge>
              )}
              {isNew && (
                <Badge className="bg-gradient-to-r from-info to-info/80 px-1.5 py-0.5 text-[10px] text-info-foreground shadow-md">
                  Novidade
                </Badge>
              )}
              {isOnSale && (
                <Badge className="bg-gradient-to-r from-destructive to-destructive/80 px-1.5 py-0.5 text-[10px] text-destructive-foreground shadow-md">
                  Promoção
                </Badge>
              )}
              {isKit && (
                <Badge className="bg-gradient-to-r from-warning to-warning/80 px-1.5 py-0.5 text-[10px] text-warning-foreground shadow-md">
                  <Layers className="mr-0.5 h-2.5 w-2.5" />
                  KIT
                </Badge>
              )}
            </div>

            {/* Inactive overlay */}
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Badge variant="destructive" className="px-3 py-1 text-xs">
                  Inativo
                </Badge>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-2 p-3">
            {/* SKU & Brand */}
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {sku || 'SEM-SKU'}
              </span>
              {brand && (
                <span className="flex max-w-[100px] shrink-0 items-center gap-1 truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  <Building2 className="h-2.5 w-2.5 shrink-0" />
                  {brand}
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="line-clamp-2 min-h-[2.25rem] font-display text-sm font-semibold leading-snug text-foreground">
              {name || <span className="italic text-muted-foreground/40">Nome do produto</span>}
            </h3>

            {/* Price & Stock */}
            <div className="flex items-end justify-between pt-1">
              <div>
                <p className="mb-0.5 text-[10px] text-muted-foreground">A partir de</p>
                <span className="font-display text-base font-bold text-foreground">
                  {salePrice > 0 ? (
                    formatPrice(salePrice)
                  ) : (
                    <span className="text-muted-foreground/40">R$ 0,00</span>
                  )}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={cn('flex items-center gap-1 text-[10px] font-medium', stock.color)}
                >
                  <Package className="h-2.5 w-2.5" />
                  {stock.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {stockQuantity.toLocaleString('pt-BR')} un.
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Additional images thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-1.5 px-1">
            {images.slice(0, 4).map((img, i) => (
              <div
                key={i}
                className="h-10 w-10 overflow-hidden rounded-md border border-border/50 bg-muted/30"
              >
                <img
                  src={getCdnUrl(img, 'card')}
                  alt={`Imagem ${i + 1}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            ))}
            {images.length > 4 && (
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/50 bg-muted/30">
                <span className="text-[10px] font-medium text-muted-foreground">
                  +{images.length - 4}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Status summary */}
        <div className="border-t border-border/30 px-1 pt-1">
          <p className="text-[10px] italic text-muted-foreground/60">
            Preview atualizado em tempo real conforme você edita os campos do formulário.
          </p>
        </div>
      </div>
    );
  },
);
