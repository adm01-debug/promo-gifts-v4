import { useState } from 'react';
import { Package, Tag, Palette, Truck } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/products';

interface ProductHoverPreviewProps {
  product: Product;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function ProductHoverPreview({
  product,
  children,
  side = 'right',
  align = 'center',
}: ProductHoverPreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className="w-80 overflow-hidden p-0"
        sideOffset={8}
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {!imageLoaded && <div className="absolute inset-0 bg-muted/30" />}
          <img
            src={product.images[0]}
            alt={product.name}
            className={cn(
              'h-full w-full object-cover transition-all duration-700 ease-out',
              imageLoaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-40 blur-md',
            )}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Badges overlay */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.featured && (
              <Badge className="bg-primary text-xs text-primary-foreground">Destaque</Badge>
            )}
            {product.newArrival && (
              <Badge className="bg-info text-xs text-info-foreground">Novidade</Badge>
            )}
          </div>

          {/* Price overlay */}
          <div className="absolute bottom-2 right-2">
            <span className="rounded-full bg-card/95 px-3 py-1.5 text-sm font-bold text-foreground shadow-lg backdrop-blur-sm">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          {/* Header */}
          <div>
            <p className="text-xs font-medium text-muted-foreground">{product.supplier.name}</p>
            <h4 className="mt-0.5 line-clamp-2 font-semibold text-foreground">{product.name}</h4>
          </div>

          <Separator />

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span>{product.stock.toLocaleString('pt-BR')} un.</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span>Mín. {product.minQuantity || 1} un.</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span>{product.colors.length} cores</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-3.5 w-3.5 text-primary" />
              <span>Consultar prazo</span>
            </div>
          </div>

          {/* Colors preview */}
          {product.colors.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              {product.colors.slice(0, 8).map((color, idx) => (
                <div
                  key={idx}
                  className="h-4 w-4 rounded-full border border-border/50 shadow-sm"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
              {product.colors.length > 8 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  +{product.colors.length - 8}
                </span>
              )}
            </div>
          )}

          {/* Materials */}
          {Array.isArray(product.materials) && product.materials.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.materials.slice(0, 3).map((material) => (
                <Badge key={material} variant="secondary" className="h-5 py-0 text-xs">
                  {material}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
