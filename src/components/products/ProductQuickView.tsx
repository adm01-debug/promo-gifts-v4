import { useState, useMemo, useEffect, forwardRef } from "react";
// framer-motion removido — transição via CSS animate-fade-in
import {
  Heart,
  GitCompare,
  Share2,
  ShoppingCart,
  Package,
  Truck, ExternalLink, Plus,
  Minus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/a11y/VisuallyHidden";
import { cn } from "@/lib/utils";
import { useProductImages } from "@/hooks/products/useProductImages";
import type { Product } from "@/types/product-catalog";
import { ProductCategoryBadges } from "./ProductCategoryBadges";
import { QuickViewGallery } from "./quick-view/QuickViewGallery";
import { ProductColorSelector, type ProductColor } from "./ProductColorSelector";
import { sortByColorGroup } from "@/utils/colorSorting";
import { toast } from "sonner";
import { getCdnUrl, getSrcSet, getColorImages, type ProductImageMeta } from "@/utils/image-utils";
import { PriceFreshnessBadge } from "@/components/products/PriceFreshnessBadge";

interface ProductQuickViewProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  onShare?: (product: Product) => void;
}

export const ProductQuickView = forwardRef<HTMLDivElement, ProductQuickViewProps>(({
  product,
  open,
  onOpenChange,
  isFavorited = false,
  onToggleFavorite,
  isInCompare = false,
  onToggleCompare,
  onShare,
}, _ref) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  // imageLoaded removido — transição instantânea sem skeleton intermediário
  const [_imageError, setImageError] = useState(false);

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
    return productImages.map(img => ({
      id: img.id,
      url_cdn: img.url_cdn,
      url_original: img.url_original || null,
      image_type: img.image_type,
      is_primary: img.is_primary,
      is_og_image: img.is_og_image || false,
      applies_to_color: img.supplier_code ? true : null,
      supplier_code: img.supplier_code || null,
      alt_text: img.alt_text,
      title_text: img.title_text,
      display_order: img.display_order,
    }));
  }, [productImages]);

  // Determinar imagens a exibir com base na cor selecionada
  const displayImages = useMemo(() => {
    if (!product) return [];

    // Se temos imagens do hook useProductImages, usar elas
    if (imageMetas.length > 0) {
      if (selectedColorId) {
        const filtered = getColorImages(imageMetas, selectedColorId);
        return filtered.length > 0 ? filtered : imageMetas;
      }
      return imageMetas;
    }

    // Fallback: usar imagens do product.images (legado)
    return product.images.map((url, idx) => ({
      url_cdn: url,
      url_original: url,
      image_type: idx === 0 ? 'main' : 'gallery',
      is_primary: idx === 0,
      display_order: idx,
      alt_text: null,
      title_text: null,
    } as ProductImageMeta));
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
    (color) => color.hex
  );
  const productColors: ProductColor[] = sortedColors.map((color, idx) => ({
    id: color.code || `${product.id}-color-${idx}`,
    name: color.name,
    hex: color.hex,
    variationName: color.name,
    groupName: color.group,
  }));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getStockStatusInfo = (status: string) => {
    switch (status) {
      case "in-stock":
        return { label: "Em estoque", color: "text-success", bg: "bg-success/10" };
      case "low-stock":
        return { label: "Estoque baixo", color: "text-warning", bg: "bg-warning/10" };
      case "out-of-stock":
        return { label: "Sem estoque", color: "text-destructive", bg: "bg-destructive/10" };
      default:
        return { label: "Em estoque", color: "text-success", bg: "bg-success/10" };
    }
  };

  const stockInfo = getStockStatusInfo(product.stockStatus);

  // Obter URL atual da imagem com variante CDN
  const currentImage = displayImages[currentImageIndex] || displayImages[0];
  const _currentImageUrl = currentImage
    ? getCdnUrl(currentImage.url_cdn, 'large')
    : '/placeholder.svg';
  const _currentImageSrcSet = currentImage
    ? getSrcSet(currentImage.url_cdn)
    : undefined;
  const _currentAlt = currentImage?.alt_text || `${product.name} - Imagem ${currentImageIndex + 1}`;

  const _handlePrevImage = () => {
    setImageError(false);
    setCurrentImageIndex((prev) =>
      prev === 0 ? displayImages.length - 1 : prev - 1
    );
  };

  const _handleNextImage = () => {
    setImageError(false);
    setCurrentImageIndex((prev) =>
      prev === displayImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(product.id);
      toast.success(
        isFavorited
          ? `"${product.name}" removido dos favoritos`
          : `"${product.name}" adicionado aos favoritos`
      );
    }
  };

  const handleCompare = () => {
    if (onToggleCompare) {
      const result = onToggleCompare(product.id);
      if (result.isFull) {
        toast.error("Limite de 4 produtos para comparação atingido");
      } else {
        toast.success(
          result.added
            ? `"${product.name}" adicionado à comparação`
            : `"${product.name}" removido da comparação`
        );
      }
    }
  };

  const handleViewDetails = () => {
    onOpenChange(false);
    // Pass selected color to product detail page with full context (cor + hex + grupo)
    if (selectedColorId && product.colors?.length) {
      const selectedColor = product.colors.find(c => c.id === selectedColorId);
      if (selectedColor) {
        const params = new URLSearchParams();
        params.set('cor', selectedColor.name);
        if (selectedColor.hex) params.set('hex', selectedColor.hex);
        if ('groupSlug' in selectedColor && selectedColor.groupSlug) params.set('grupo', String(selectedColor.groupSlug));
        navigate(`/produto/${product.id}?${params.toString()}`);
        return;
      }
    }
    navigate(`/produto/${product.id}`);
  };

  const handleColorSelect = (color: ProductColor) => {
    const newId = color.id || null;
    setSelectedColorId(prev => prev === newId ? null : newId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border gap-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <VisuallyHidden>
          <DialogTitle>Visualização rápida: {product.name}</DialogTitle>
        </VisuallyHidden>
        
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image Gallery */}
          <QuickViewGallery
            productName={product.name}
            images={product.images}
            displayImages={displayImages}
            currentImageIndex={currentImageIndex}
            onIndexChange={(idx) => { setCurrentImageIndex(idx); }}
            featured={product.featured}
            newArrival={product.newArrival}
            isKit={product.isKit}
          />

          {/* Product Info */}
          <div className="p-6 flex flex-col">
            {/* Header */}
            <div className="space-y-3">
              {/* Category Badges - Ícones das categorias */}
              <ProductCategoryBadges 
                category={product.category} 
                groups={product.groups}
                categoryUuid={product.category_id}
              />
              
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                  {product.supplier.name}
                </span>
              </div>

              <h2 data-testid="product-quickview-name" className="text-2xl font-display font-bold text-foreground leading-tight">
                {product.name}
              </h2>

              <p className="text-sm text-muted-foreground">
                SKU: {product.sku}
              </p>
            </div>

            <Separator className="my-4" />

            {/* Price & Stock */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">A partir de</p>
                <span className="text-3xl font-display font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                <div className="mt-1.5">
                  <PriceFreshnessBadge
                    priceUpdatedAt={product.priceUpdatedAt}
                    thresholdDays={product.priceFreshnessThresholdDays}
                    variant="inline"
                    alwaysShow
                  />
                </div>
              </div>
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full", stockInfo.bg)}>
                <Package className={cn("h-4 w-4", stockInfo.color)} />
                <span className={cn("text-sm font-medium", stockInfo.color)}>
                  {stockInfo.label}
                </span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Colors - Usando o sistema hierárquico com filtragem de imagens */}
            {productColors.length > 0 && (
              <ProductColorSelector
                colors={productColors}
                selectedColorId={selectedColorId}
                onColorSelect={handleColorSelect}
                maxVisible={8}
                size="md"
              />
            )}

            {/* Quantity */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Quantidade</p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon" aria-label="Remover"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon" aria-label="Adicionar"
                  className="h-9 w-9"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  = {formatPrice(product.price * quantity)}
                </span>
              </div>
            </div>

            {/* Delivery info */}
            <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-center gap-3">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Entrega estimada</p>
                <p className="text-muted-foreground">3-5 dias úteis após aprovação</p>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1 min-h-4" />

            {/* Actions */}
            <div className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-11 w-11",
                        isFavorited && "bg-destructive/10 border-destructive/30 text-destructive"
                      )}
                      onClick={handleFavorite}
                      data-testid="product-favorite"
                      aria-pressed={isFavorited}
                     aria-label="Favoritar"><Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-11 w-11",
                        isInCompare && "bg-primary/10 border-primary/30 text-primary"
                      )}
                      onClick={handleCompare}
                     aria-label="Comparar"><GitCompare className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isInCompare ? "Remover da comparação" : "Adicionar à comparação"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon" aria-label="Compartilhar"
                      className="h-11 w-11"
                      onClick={() => onShare?.(product)}
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Compartilhar</TooltipContent>
                </Tooltip>

                <Button
                  data-testid="product-quickview-add-to-quote"
                  variant="orange"
                  className="flex-1 h-11"
                  onClick={() => {
                    onOpenChange(false);
                    const params = new URLSearchParams({
                      product_id: product.id,
                      product_name: product.name || '',
                      product_sku: product.sku || '',
                      product_price: String(product.price ?? 0),
                    });
                    if (product.images?.[0]) params.set('product_image', product.images[0]);
                    navigate(`/orcamentos/novo?${params.toString()}`);
                  }}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Adicionar ao Orçamento
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full h-11"
                onClick={handleViewDetails}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Detalhes Completos
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
ProductQuickView.displayName = "ProductQuickView";
