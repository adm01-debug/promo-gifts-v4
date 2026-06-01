/**
 * EnhancedProductCard - Card de produto melhorado com hover preview e ações rápidas
 * Inclui preview expandido, quick-add e badges de urgência
 */

import { useState, useRef } from 'react';
import { Heart, Eye, Share2, GitCompare, ShoppingCart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/products';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { ProductStatusBadge } from './ProductStatusBadge';

interface EnhancedProductCardProps {
  product: Product;
  onClick?: () => void;
  onQuickAdd?: (product: Product, quantity: number) => void;
  onFavorite?: (product: Product) => void;
  onCompare?: (product: Product) => void;
  onShare?: (product: Product) => void;
  onStatusClick?: (type: string, urgencyType?: string) => void;
  isFavorited?: boolean;
  isInComparison?: boolean;
  className?: string;
}

export function EnhancedProductCard({
  product,
  onClick,
  onQuickAdd,
  onFavorite,
  onCompare,
  onShare,
  onStatusClick,
  isFavorited = false,
  isInComparison = false,
  className,
}: EnhancedProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [quantity, setQuantity] = useState(product.minOrder || 1);
  const cardRef = useRef<HTMLElement>(null);

  const urgencyType =
    product.stockStatus === 'critical'
      ? 'critical'
      : product.stockStatus === 'low'
        ? 'low'
        : undefined;
  const urgencyText =
    urgencyType === 'critical' ? 'Crítico' : urgencyType === 'low' ? 'Baixo' : undefined;

  return (
    <article
      ref={cardRef}
      className={cn(
        'card-glow group relative overflow-hidden rounded-2xl bg-card',
        'cursor-pointer',
        isHovered && 'ring-2 ring-primary/20',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Urgency badge */}
      {urgencyType && urgencyText && (
        <div className="absolute left-3 top-3 z-20 animate-fade-in">
          <ProductStatusBadge
            type="urgency"
            urgencyType={urgencyType}
            value={urgencyText}
            size="sm"
            onClick={() => onStatusClick?.('urgency', urgencyType)}
          />
        </div>
      )}

      <article
        className={cn(
          'card-glow group relative overflow-hidden rounded-2xl bg-card',
          'cursor-pointer',
          isHovered && 'ring-2 ring-primary/20',
        )}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/10">
          <img
            src={product.imageUrl}
            alt={product.name}
            className={cn(
              'h-full w-full object-contain transition-transform duration-500',
              isHovered && 'scale-105',
            )}
            loading="lazy"
          />

          {/* Featured badge */}
          {product.featured && (
            <div className="absolute right-3 top-3 z-10">
              <ProductStatusBadge
                type="featured"
                size="sm"
                onClick={() => onStatusClick?.('featured')}
              />
            </div>
          )}

          {/* Overlay actions */}
          <div
            className={cn(
              'absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 to-transparent p-4 transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <div className="flex w-full gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd?.(product, quantity);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* Card content */}
        <div className="p-3">
          <p className="mb-0.5 line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
          <p className="mb-2 text-xs text-muted-foreground">{product.sku}</p>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {product.salePrice ? (
                <>
                  <span className="text-base font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      product.salePrice,
                    )}
                  </span>
                  {product.listPrice && product.listPrice > product.salePrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(product.listPrice)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Preço sob consulta</span>
              )}
            </div>

            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 backdrop-blur-sm">
                {product.colors
                  .slice(0, 4)
                  .map((color: { hex: string; name?: string }, idx: number) => (
                    <div
                      key={`${color.hex}-${idx}`}
                      className="h-4 w-4 rounded-full border-2 border-card shadow-sm"
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                {product.colors.length > 4 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    +{product.colors.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Freshness badge */}
          <div className="mt-2">
            <PriceFreshnessBadge product={product} size="sm" />
          </div>
        </div>

        {/* Sidebar actions */}
        <div
          className={cn(
            'absolute right-0 top-12 flex flex-col gap-1 p-1 transition-all duration-300',
            isHovered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite?.(product);
                }}
              >
                <Heart className={cn('h-3.5 w-3.5', isFavorited && 'fill-current text-red-500')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare?.(product);
                }}
              >
                <GitCompare className={cn('h-3.5 w-3.5', isInComparison && 'text-primary')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Comparar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.(product);
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Compartilhar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Ver detalhes</TooltipContent>
          </Tooltip>
        </div>

        {/* Quantity selector */}
        <div
          className={cn(
            'absolute bottom-16 left-3 right-3 flex items-center justify-between rounded-lg bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-sm transition-[opacity,transform] duration-200',
            isHovered ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground">Qtd:</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() =>
                setQuantity((q) => Math.max(product.minOrder || 1, q - (product.minOrder || 1)))
              }
            >
              <span className="text-sm font-bold">-</span>
            </Button>
            <Badge variant="secondary" className="min-w-[2rem] justify-center text-xs">
              {quantity}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setQuantity((q) => q + (product.minOrder || 1))}
            >
              <span className="text-sm font-bold">+</span>
            </Button>
          </div>
          <Button
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={() => onQuickAdd?.(product, quantity)}
          >
            <ChevronRight className="h-3 w-3" />
            OK
          </Button>
        </div>
      </article>
    </article>
  );
}
