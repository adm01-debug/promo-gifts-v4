import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Heart,
  ShoppingCart,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Share2,
  FileText,
  FolderPlus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CartSelectorDialog } from '@/components/cart/CartSelectorDialog';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getCdnUrl, getSrcSet, getColorImages, type ProductImageMeta } from '@/utils/image-utils';
import { useProductImages } from '@/hooks/products/useProductImages';
import {
  ProductColorSelector,
  type ProductColor,
} from '@/components/products/ProductColorSelector';
import { type Product } from '@/types/product-catalog';
import { sortByColorGroup } from '@/utils/colorSorting';
import { cn } from '@/lib/utils';

// Image types that are excluded from the gallery (ADR-001)
const TECHNICAL_IMAGE_TYPES = new Set(['box', 'pouch', 'location', 'area', 'component']);

interface ProductQuickViewProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: boolean;
  canAddToCompare?: boolean;
  onToggleCompare?: (productId: string) => void;
  onAddToCart?: (productId: string, quantity: number, colorId?: string) => void;
  onNavigateToProduct?: (productId: string) => void;
  onShare?: (product: Product) => void;
  onAddToQuote?: (product: Product) => void;
  onAddToCollection?: (product: Product) => void;
}

export const ProductQuickView = React.memo(
  ({
    product,
    open,
    onOpenChange,
    isFavorited = false,
    onToggleFavorite,
    isInCompare = false,
    canAddToCompare = true,
    onToggleCompare,
    onAddToCart,
    onNavigateToProduct,
    onShare,
    onAddToQuote,
    onAddToCollection,
  }: ProductQuickViewProps) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
    // imageLoaded removido — transição instantânea sem skeleton intermediário
    const [_imageError, setImageError] = useState(false);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const { carts, addToActiveCart, canCreateCart } = useSellerCartContext();

    // Hook: buscar imagens do produto via BD externo (Briefing v3)
    const { data: productImages = [] } = useProductImages(open && product ? product.id : null);

    // Reset state quando produto muda ou modal abre
    useEffect(() => {
      if (open) {
        setCurrentImageIndex(0);
        setQuantity(1);
        setSelectedColorId(null);
        // reset states
        setImageError(false);
      }
    }, [open, product?.id]);

    // Converter ProductImage[] para ProductImageMeta[] para usar com image-utils
    const imageMetas: ProductImageMeta[] = useMemo(() => {
      if (productImages.length === 0) return [];
      return productImages.map((img) => ({
        id: img.id,
        url_cdn: img.url_cdn,
        url_original: img.url_original || null,
        image_type: img.image_type,
        is_primary: img.is_primary,
        is_og_image: img.is_og_image || false,
        applies_to_color: img.applies_to_color ?? null,
        supplier_code: img.supplier_code || null,
        alt_text: img.alt_text,
        title_text: img.title_text,
        display_order: img.display_order,
      }));
    }, [productImages]);

    // Determinar imagens a exibir com base na cor selecionada.
    // A imagem type='main' (is_primary=true) é a imagem principal do produto e deve
    // sempre aparecer em primeiro lugar, independentemente de display_order ou filtro de cor.
    const displayImages = useMemo(() => {
      if (!product) return [];

      if (imageMetas.length > 0) {
        // Tipos técnicos nunca aparecem na galeria (ADR-001)
        const galleryMetas = imageMetas.filter((img) => !TECHNICAL_IMAGE_TYPES.has(img.image_type));

        // Hero: main com is_primary=true → qualquer main → primeiro por display_order
        const hero =
          galleryMetas.find((img) => img.image_type === 'main' && img.is_primary) ??
          galleryMetas.find((img) => img.image_type === 'main');

        if (selectedColorId) {
          // getColorImages garante: hero primeiro, color-specific depois, sem técnicos
          const filtered = getColorImages(galleryMetas, selectedColorId);
          if (filtered.length > 0) return filtered;
          // Fallback: hero + todas não-técnicas quando cor não tem match
          return hero ? [hero, ...galleryMetas.filter((img) => img !== hero)] : galleryMetas;
        }

        // Sem cor: hero primeiro, depois restante por display_order
        if (hero) return [hero, ...galleryMetas.filter((img) => img !== hero)];
        return galleryMetas;
      }

      // Fallback: usar imagens do product.images (legado)
      return product.images.map(
        (url, idx) =>
          ({
            url_cdn: url,
            url_original: url,
            image_type: idx === 0 ? 'main' : 'gallery',
            is_primary: idx === 0,
            display_order: idx,
            alt_text: null,
            title_text: null,
          }) as ProductImageMeta,
      );
    }, [imageMetas, selectedColorId, product]);

    // Reset index quando imagens mudam
    useEffect(() => {
      setCurrentImageIndex(0);
      // reset on color change
      setImageError(false);
    }, [selectedColorId]);

    // Early return if product is null
    if (!product) return null;

    // Mapear cores do produto para o formato do seletor com ordenação padronizada
    const sortedColors = sortByColorGroup(
      product.colors || [],
      (color) => color.name || '',
      (color) => color.hex,
    );
    const productColors: ProductColor[] = sortedColors.map((color, idx) => ({
      id: color.code || `${product.id}-color-${idx}`,
      name: color.name,
      hex: color.hex,
      variationName: color.name,
      groupName: color.group,
    }));

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(price);
    };

    const getStockStatusInfo = (status: string) => {
      switch (status) {
        case 'in-stock':
          return { label: 'Em estoque', color: 'text-success', bg: 'bg-success/10' };
        case 'low-stock':
          return { label: 'Estoque baixo', color: 'text-warning', bg: 'bg-warning/10' };
        case 'out-of-stock':
          return { label: 'Estoque zerado', color: 'text-destructive', bg: 'bg-destructive/10' };
        default:
          return { label: 'Em estoque', color: 'text-success', bg: 'bg-success/10' };
      }
    };

    const stockInfo = getStockStatusInfo(product.stockStatus);

    // O badge de unidades usa product.stock (number no tipo de catálogo). Guarda
    // leve apenas para o caso de o runtime trazer um valor não-numérico do mapper.
    const stockQty: number | null = typeof product.stock === 'number' ? product.stock : null;

    // Obter URL atual da imagem com variante CDN
    const currentImage = displayImages[currentImageIndex] || displayImages[0];
    const _currentImageUrl = currentImage
      ? getCdnUrl(currentImage.url_cdn, 'large')
      : '/placeholder.svg';
    const _currentImageSrcSet = currentImage ? getSrcSet(currentImage.url_cdn) : undefined;
    const _currentAlt =
      currentImage?.alt_text || `${product.name} - Imagem ${currentImageIndex + 1}`;

    const _handlePrevImage = () => {
      setImageError(false);
      setCurrentImageIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
    };

    const _handleNextImage = () => {
      setImageError(false);
      setCurrentImageIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
    };

    const handleFavorite = () => {
      if (onToggleFavorite) {
        onToggleFavorite(product.id);
        toast.success(
          isFavorited
            ? `"${product.name}" removido dos favoritos`
            : `"${product.name}" adicionado aos favoritos`,
        );
      }
    };

    const handleCompare = () => {
      if (onToggleCompare) {
        onToggleCompare(product.id);
      }
    };

    const handleAddToCart = (cartId?: string) => {
      // Se temos múltiplos carrinhos e nenhum foi explicitamente passado, mostramos o seletor
      if (!cartId && carts.length > 1 && !selectorOpen) {
        setSelectorOpen(true);
        return;
      }

      const selectedColor = productColors.find((c) => c.id === selectedColorId);

      addToActiveCart(
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku || undefined,
          product_image_url: displayImages[currentImageIndex]?.url_cdn || product.images?.[0],
          product_price: product.price ?? 0,
          quantity,
          color_name: selectedColor?.name || undefined,
          color_hex: selectedColor?.hex || undefined,
        },
        cartId,
      );

      setSelectorOpen(false);
      if (onAddToCart) {
        onAddToCart(product.id, quantity, selectedColorId || undefined);
      }
    };

    const handleNavigate = () => {
      if (onNavigateToProduct) {
        onNavigateToProduct(product.id);
        onOpenChange(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'max-h-[90vh] w-full max-w-4xl overflow-y-auto p-0',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <DialogClose className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background">
            <X className="h-4 w-4" />
          </DialogClose>

          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Visualização rápida do produto {product.name}
          </DialogDescription>

          <CartSelectorDialog
            open={selectorOpen}
            onOpenChange={setSelectorOpen}
            carts={carts}
            productName={product.name}
            canCreateMore={canCreateCart}
            onSelect={(id) => handleAddToCart(id)}
            onCreateNew={() => setSelectorOpen(false)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Image Section */}
            <div className="relative bg-muted/30 p-6">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-background">
                {currentImage ? (
                  <img
                    src={_currentImageUrl}
                    srcSet={_currentImageSrcSet}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={_currentAlt}
                    className="h-full w-full object-contain transition-opacity duration-300"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ZoomIn className="h-12 w-12 opacity-20" />
                  </div>
                )}

                {displayImages.length > 1 && (
                  <>
                    <button
                      onClick={_handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background"
                      aria-label="Imagem anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={_handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background"
                      aria-label="Próxima imagem"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {displayImages.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {displayImages.slice(0, 8).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentImageIndex(idx);
                        setImageError(false);
                      }}
                      className={cn(
                        'h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                        idx === currentImageIndex
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted-foreground/30',
                      )}
                    >
                      <img
                        src={getCdnUrl(img.url_cdn, 'thumbnail')}
                        alt={img.alt_text || `Imagem ${idx + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex flex-col gap-4 p-6">
              {/* Header */}
              <div>
                {product.brand && (
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {product.brand}
                  </p>
                )}
                <h2 className="mt-1 text-xl font-semibold leading-tight">{product.name}</h2>
                {product.sku && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    SKU: {product.sku}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {product.price ? formatPrice(product.price) : 'Consulte'}
                </span>
                {product.onSale && product.comparePrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.comparePrice)}
                  </span>
                )}
              </div>

              {/* Stock status */}
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  stockInfo.bg,
                  stockInfo.color,
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {stockInfo.label}
                {stockQty !== null && stockQty > 0 && (
                  <span className="opacity-70">({stockQty} un.)</span>
                )}
              </div>

              {/* Colors */}
              {productColors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Cor
                    {selectedColorId
                      ? `: ${productColors.find((c) => c.id === selectedColorId)?.name ?? ''}`
                      : ''}
                  </p>
                  <ProductColorSelector
                    colors={productColors}
                    selectedColorId={selectedColorId}
                    onColorSelect={(color) => setSelectedColorId(color.id ?? null)}
                    size="md"
                  />
                </div>
              )}

              {/* Quantity */}
              <div>
                <p className="mb-2 text-sm font-medium">Quantidade</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.max(product.minQuantity || 1, q - (product.minQuantity || 1)),
                      )
                    }
                    aria-label="Diminuir quantidade"
                  >
                    <span className="text-lg leading-none">−</span>
                  </Button>
                  <span className="w-12 text-center font-medium tabular-nums">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity((q) => q + (product.minQuantity || 1))}
                    aria-label="Aumentar quantidade"
                  >
                    <span className="text-lg leading-none">+</span>
                  </Button>
                </div>
              </div>

              {/* Short description */}
              {product.shortDescription && (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {product.shortDescription}
                </p>
              )}

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  {onAddToCart && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddToCart()}
                      disabled={product.stockStatus === 'out-of-stock'}
                      className="flex-shrink-0"
                      aria-label="Adicionar ao carrinho"
                      data-testid="product-quickview-cart"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  )}
                  {onToggleFavorite && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleFavorite}
                      className={cn(
                        'flex-shrink-0',
                        isFavorited && 'border-red-200 bg-red-50 text-red-500',
                      )}
                      aria-label={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
                    </Button>
                  )}

                  {onToggleCompare && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCompare}
                      disabled={!isInCompare && !canAddToCompare}
                      className={cn(
                        'flex-shrink-0',
                        isInCompare && 'border-primary/30 bg-primary/5 text-primary',
                      )}
                      aria-label={isInCompare ? 'Remover da comparação' : 'Comparar produto'}
                    >
                      <BarChart2 className="h-4 w-4" />
                    </Button>
                  )}

                  {onAddToQuote && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onAddToQuote(product)}
                      className="flex-shrink-0"
                      aria-label="Adicionar ao orçamento"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}

                  {onAddToCollection && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onAddToCollection(product)}
                      className="flex-shrink-0"
                      aria-label="Adicionar à coleção"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      if (onShare) {
                        onShare(product);
                        return;
                      }
                      const url = typeof window !== 'undefined' ? window.location.href : '';
                      try {
                        if (typeof navigator !== 'undefined' && 'share' in navigator) {
                          await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
                            title: product.name,
                            url,
                          });
                        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(url);
                          toast.success('Link copiado');
                        }
                      } catch {
                        /* user cancelled */
                      }
                    }}
                    className="flex-shrink-0"
                    aria-label="Compartilhar"
                    data-testid="product-quickview-share"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>

                  {onNavigateToProduct && (
                    <Button variant="outline" onClick={handleNavigate} className="flex-1">
                      Ver produto completo
                    </Button>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                {product.newArrival && <Badge variant="secondary">Novidade</Badge>}
                {product.onSale && <Badge variant="destructive">Promoção</Badge>}
                {product.featured && <Badge variant="outline">Destaque</Badge>}
                {product.isKit && <Badge variant="outline">Kit</Badge>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);

ProductQuickView.displayName = 'ProductQuickView';
