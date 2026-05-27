/**
 * ProductDetailHero — Seção hero com galeria + info do produto
 * Extraído de ProductDetail para reduzir complexidade
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Package, Clock, Tag, Layers, Sparkles, FileText, Eye } from 'lucide-react';
import { ProductGallery } from '@/components/products/ProductGallery';
import { KitComposition } from '@/components/products/KitComposition';
import { ProductCategoryBadges } from '@/components/products/ProductCategoryBadges';
import { GenderBadge } from '@/components/products/GenderBadge';
import { ProductQuickActions } from '@/components/products/ProductQuickActions';
import { ProductInfoBar } from '@/components/products/ProductInfoBar';
import { PackagingBadge } from '@/components/products/PackagingBadge';
import { ProductDimensions } from '@/components/products/ProductDimensions';
import { QuickAddToQuote } from '@/components/products/QuickAddToQuote';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import { DynamicTrustBadges, type SupplierTrustData } from '@/components/common/SocialProof';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';

import { useProductFreshnessOverride, type Product } from '@/hooks/products';
import { DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS } from '@/utils/price-freshness';
import { cn } from '@/lib/utils';
import { sortVariationsByColor } from '@/utils/colorSorting';
import type { ProductVariation } from '@/types/product-catalog';
import { formatCurrency } from '@/lib/format';

interface ProductDetailHeroProps {
  product: Product;
  id: string;
  selectedVariation: ProductVariation | null;
  setSelectedVariation: (v: ProductVariation | null) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  viewCount: number;
  supplierTrust: SupplierTrustData | null;
  onOpenPackagingModal: () => void;
  onOpenFutureStock: () => void;
  onOpenSupplierComparison: () => void;
}

const getStockStatusInfo = (status: string) => {
  switch (status) {
    case 'in-stock':
      return { label: 'Em estoque', class: 'bg-success/10 text-success border-success/20' };
    case 'low-stock':
      return { label: 'Estoque baixo', class: 'bg-warning/10 text-warning border-warning/20' };
    case 'out-of-stock':
      return {
        label: 'Sem estoque',
        class: 'bg-destructive/10 text-destructive border-destructive/20',
      };
    default:
      return { label: 'Consultar', class: 'bg-muted text-muted-foreground' };
  }
};

export function ProductDetailHero({
  product,
  id,
  selectedVariation,
  setSelectedVariation,
  isFavorite,
  onToggleFavorite,
  viewCount,
  supplierTrust,
  onOpenPackagingModal,
  onOpenFutureStock,
  onOpenSupplierComparison,
}: ProductDetailHeroProps) {
  const navigate = useNavigate();
  const [quoteVariantWizardOpen, setQuoteVariantWizardOpen] = useState(false);

  const minQuantity = product.minQuantity || 1;
  const stockInfo = getStockStatusInfo(product.stockStatus);

  // Override local (admin-only) tem precedência sobre o valor exposto pelo BD
  // externo. Quando ambos são nulos, o util cai no default de 60 dias.
  const { data: freshnessOverride } = useProductFreshnessOverride(id);
  const effectiveThresholdDays =
    freshnessOverride?.threshold_days ??
    product.priceFreshnessThresholdDays ??
    DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS;

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 xl:gap-8">
      {/* LEFT — Gallery */}
      <div className="min-w-0">
        <div className="space-y-3 pb-4 lg:sticky lg:top-20">
          <ProductGallery
            images={product.images}
            video={product.video ?? undefined}
            productVideos={product.productVideos as never}
            productName={product.name}
            colors={product.variations?.map((variation: ProductVariation) => ({
              name: variation.color?.name || 'Cor',
              hex: variation.color?.hex || '#CCC',
              sku: variation.sku,
              stock: variation.stock,
              image: variation.image ?? undefined,
              images: variation.images,
              videos: variation.videos as never,
            }))}
            onColorSelect={(index: number) => {
              if (index === -1) setSelectedVariation(null);
              else if (product.variations?.[index]) setSelectedVariation(product.variations[index]);
            }}
            selectedColorIndex={
              product.variations?.findIndex(
                (v: ProductVariation) => v.id === selectedVariation?.id,
              ) ?? -1
            }
          />
        </div>
      </div>

      {/* RIGHT — Info */}
      <div className="flex min-w-0 flex-col gap-3 md:gap-4 xl:gap-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <ProductCategoryBadges
              category={product.category as never}
              groups={product.groups}
              categoryUuid={product.category_id}
              productId={product.id}
              productName={product.name}
              productSku={product.sku}
              productPrice={product.price}
              productImageUrl={product.images?.[0]}
              productMinQuantity={minQuantity}
              isKit={product.isKit}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.featured && (
              <Badge className="bg-gradient-primary px-2 py-0.5 text-[11px] text-primary-foreground shadow-sm">
                <Sparkles className="mr-1 h-3 w-3" />
                Destaque
              </Badge>
            )}
            {product.newArrival && (
              <Badge className="bg-gradient-to-r from-info to-info/80 px-2 py-0.5 text-[11px] text-info-foreground">
                Novidade
              </Badge>
            )}
            {product.onSale && (
              <Badge className="bg-gradient-to-r from-destructive to-destructive/80 px-2 py-0.5 text-[11px] text-destructive-foreground">
                Promoção
              </Badge>
            )}
            {product.isKit && (
              <Badge className="bg-gradient-to-r from-warning to-warning/80 px-2 py-0.5 text-[11px] text-warning-foreground">
                <Layers className="mr-1 h-3 w-3" />
                KIT
              </Badge>
            )}
            {product.gender && <GenderBadge gender={product.gender} size="md" />}
            <PackagingBadge
              hasCommercialPackaging={product.hasCommercialPackaging ?? null}
              packingType={product.packingType ?? null}
              repackingType={product.repackingType ?? null}
              packagingContext={(product.packagingContext ?? null) as never}
              onClick={onOpenPackagingModal}
            />
          </div>
          <h1
            data-testid="page-title-detalhe-produto"
            data-product-name={product.name}
            className="font-display text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl"
          >
            {product.name}
          </h1>
          <ProductInfoBar
            sku={selectedVariation?.sku || product.sku}
            supplierName={product.supplier.name}
            supplierId={product.supplier.id}
            onOpenFutureStock={onOpenFutureStock}
            onOpenSupplierComparison={onOpenSupplierComparison}
          />
        </div>

        {/* Price + Specs */}
        <div className="grid flex-1 grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:gap-4">
          {/* Price & CTA */}
          <div className="group/price relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/10 p-5 shadow-lg transition-all duration-500 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/10 xl:p-6">
            {product.featured && (
              <div className="from-primary/8 absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br to-transparent transition-opacity duration-500 group-hover/price:from-primary/15" />
            )}
            <div className="relative flex flex-col gap-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 xl:text-[11px]">
                  A partir de
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-foreground xl:text-4xl">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground/50">/un</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriceFreshnessBadge
                    priceUpdatedAt={product.priceUpdatedAt}
                    thresholdDays={effectiveThresholdDays}
                    variant="pdp"
                    alwaysShow
                  />
                </div>
              </div>

              {/* Stock per color */}
              {product.variations && product.variations.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Estoque por cor
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sortVariationsByColor(product.variations).map(
                      (variation: ProductVariation) => {
                        const isSelected = selectedVariation?.id === variation.id;
                        const stock = Math.max(0, variation.stock);
                        return (
                          <button
                            key={variation.id}
                            onClick={() => setSelectedVariation(variation)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedVariation(variation);
                              }
                            }}
                            title={`${variation.color?.name || 'Cor'}: ${stock.toLocaleString('pt-BR')} un.`}
                            aria-label={`Cor ${variation.color?.name || 'sem nome'}, ${stock} unidades`}
                            className={cn(
                              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-200',
                              !isSelected &&
                                'border border-border/30 bg-secondary/30 hover:bg-secondary/50',
                              stock === 0 && 'opacity-40',
                            )}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: variation.color?.hex
                                      ? `${variation.color.hex}15`
                                      : undefined,
                                    border: variation.color?.hex
                                      ? `1.5px solid ${variation.color.hex}`
                                      : undefined,
                                    boxShadow: variation.color?.hex
                                      ? `0 0 0 2px ${variation.color.hex}20`
                                      : undefined,
                                  }
                                : undefined
                            }
                          >
                            <div
                              className="h-3 w-3 shrink-0 rounded-full border border-border/40"
                              style={{ backgroundColor: variation.color?.hex || '#CCC' }}
                            />
                            <span
                              className={cn(
                                stock === 0
                                  ? 'text-destructive'
                                  : stock < 100
                                    ? 'text-warning'
                                    : 'text-muted-foreground',
                              )}
                            >
                              {stock >= 1000
                                ? `${(stock / 1000).toFixed(1)}k`
                                : stock.toLocaleString('pt-BR')}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ) : (
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    stockInfo.class,
                  )}
                >
                  <Package className="h-3.5 w-3.5" />
                  {Math.max(0, product.stock).toLocaleString('pt-BR')} un.
                </span>
              )}

              {/* Compact info */}
              <div className="flex items-center gap-4 rounded-lg border border-border/20 bg-secondary/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Tag className="h-3 w-3 shrink-0 text-primary" />
                  <span className="font-medium">Mín. {minQuantity}</span>
                </div>
                <div className="h-3.5 w-px bg-border/40" />
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0 text-info" />
                  <span className="font-medium">
                    {product.leadTimeDays
                      ? `${product.leadTimeDays} dias úteis`
                      : 'Consultar prazo'}
                  </span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex gap-2.5">
                <QuickAddToQuote
                  productId={id}
                  productName={product.name}
                  productSku={product.sku}
                  productImageUrl={product.images?.[0]}
                  productPrice={product.price}
                  minQuantity={minQuantity}
                  variant="button"
                  buttonSize="lg"
                  className="xl:h-13 h-12 flex-1 basis-0 gap-2.5 rounded-xl bg-primary font-display text-[0.875rem] font-bold tracking-[0.08em] text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                  labelOverride="Carrinho"
                  iconOverride="cart"
                />
                <Button
                  size="lg"
                  className="xl:h-13 h-12 flex-1 basis-0 gap-2.5 rounded-xl bg-success font-display text-[0.875rem] font-bold tracking-[0.08em] text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => setQuoteVariantWizardOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  Orçamento
                </Button>
                <BulkVariantWizard
                  open={quoteVariantWizardOpen}
                  onOpenChange={setQuoteVariantWizardOpen}
                  products={[product]}
                  mode="quote"
                  onComplete={(selections) => {
                    const s = selections[0];
                    const v = s?.variant;
                    const params = new URLSearchParams({
                      product_id: id,
                      product_name: product.name,
                      product_sku: product.sku || '',
                      product_price: String(product.price),
                      product_image: v?.selected_thumbnail || product.images?.[0] || '',
                      min_quantity: String(minQuantity),
                    });
                    if (v?.color_name) params.set('color_name', v.color_name);
                    if (v?.color_hex) params.set('color_hex', v.color_hex);
                    if (v?.size_code) params.set('size_code', v.size_code);
                    navigate(`/orcamentos/novo?${params.toString()}`);
                  }}
                />
              </div>

              {/* Trust + Social proof */}
              <div className="space-y-2.5 pt-1">
                <DynamicTrustBadges
                  trust={
                    supplierTrust ?? { isVerified: false, deliveryDays: null, avgRating: null }
                  }
                  productFlags={{
                    newArrival: product?.newArrival ?? false,
                    onSale: product?.onSale ?? false,
                    featured: product?.featured ?? false,
                    minQuantity: product?.minQuantity,
                  }}
                  className="text-[10px]"
                />
                <div className="flex items-center gap-3 border-t border-border/30 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">{viewCount}</span>
                    <span>visualizações</span>
                  </div>
                  <div className="h-4 w-px bg-border/30" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleFavorite}
                    className={cn(
                      'h-7 gap-1.5 rounded-full px-3 text-xs transition-all duration-300 hover:scale-105 hover:bg-destructive/15 hover:text-destructive hover:shadow-md hover:shadow-destructive/20',
                      isFavorite && 'bg-destructive/10 text-destructive',
                    )}
                  >
                    <Heart
                      className={cn(
                        'h-3.5 w-3.5 transition-all duration-300',
                        isFavorite && 'scale-110 fill-destructive text-destructive',
                      )}
                    />
                    {isFavorite ? 'Favoritado' : 'Favoritar'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Specs + Description */}
          <div
            id="sec-specs"
            className="flex scroll-mt-28 flex-col gap-4 rounded-2xl border border-border/60 bg-card/40 p-5 xl:p-6"
          >
            <div id="sec-descricao" className="scroll-mt-28">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground xl:text-sm">
                Descrição
              </h4>
              {product.description ? (
                (() => {
                  const sentences = product.description
                    .split(/[.]\s+/)
                    .map((s) => s.trim().replace(/\.$/, ''))
                    .filter((s) => s.length > 5);
                  if (sentences.length > 2) {
                    return (
                      <ul className="space-y-1">
                        {sentences.map((sentence, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                            {sentence}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                  );
                })()
              ) : (
                <p className="text-xs italic text-muted-foreground">Sem descrição disponível</p>
              )}
            </div>
            <div className="space-y-3 border-t border-border/30 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-foreground xl:text-sm">
                Especificações
              </h4>
              {product.materials && product.materials.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {product.materials.map((material: string) => (
                    <Badge
                      key={material}
                      variant="secondary"
                      className="rounded-full px-2.5 py-0.5 text-[11px]"
                    >
                      {material}
                    </Badge>
                  ))}
                </div>
              )}
              <ProductDimensions dimensions={product.dimensions} compact />
            </div>
          </div>
        </div>

        {/* Kit Composition */}
        {product.isKit && product.kitItems && <KitComposition items={product.kitItems} />}

        {/* Quick Actions */}
        <div className="mt-auto">
          <ProductQuickActions
            productId={product.id}
            productName={product.name}
            productSku={product.sku}
            basePrice={product.price}
            minQuantity={minQuantity}
            tags={
              product.tags
                ? {
                    'Público-Alvo': product.tags.publicoAlvo || [],
                    'Datas Comemorativas': product.tags.datasComemorativas || [],
                    Endomarketing: product.tags.endomarketing || [],
                  }
                : undefined
            }
            niches={product.tags?.nicho || product.tags?.ramo || undefined}
            product={product}
            selectedVariant={
              selectedVariation
                ? {
                    variantName: selectedVariation.color?.name,
                    colorHex: selectedVariation.color?.hex,
                    thumbnailUrl: selectedVariation.images?.[0] || selectedVariation.image,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
