/**
 * ProductDetailHero — Seção hero com galeria + info do produto
 * Extraído de ProductDetail para reduzir complexidade
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Package, Clock, Tag, Layers, Sparkles, FileText, Eye, Gift, BookOpen } from 'lucide-react';
import { ProductGallery } from '@/components/products/ProductGallery';
import { KitComposition } from '@/components/products/KitComposition';
import { ProductCategoryBadges } from '@/components/products/ProductCategoryBadges';
import { useProductLeafCategories } from '@/hooks/products/useProductLeafCategories';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { IntelligenceBadges } from '@/components/common/IntelligenceBadges';

import {
  useProductFreshnessOverride,
  type Product,
  useProductIntelligenceBadges,
} from '@/hooks/products';
import { DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS } from '@/utils/price-freshness';
import { cn } from '@/lib/utils';
import { sortVariationsByColor } from '@/utils/colorSorting';
import type { ProductVariation } from '@/types/product-catalog';
import { formatCurrency } from '@/lib/format';
import { useWordMagic } from '@/hooks/word-magic/useWordMagic';

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
  isLoadingTags?: boolean;
  hasErrorTags?: boolean;
  isLoadingNiches?: boolean;
  hasErrorNiches?: boolean;
}

const getStockStatusInfo = (status: string) => {
  switch (status) {
    case 'in-stock':
      return { label: 'Em estoque', class: 'bg-success/10 text-success border-success/20' };
    case 'low-stock':
      return { label: 'Estoque baixo', class: 'bg-warning/10 text-warning border-warning/20' };
    case 'out-of-stock':
      return {
        label: 'Estoque zerado',
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
  isLoadingTags,
  hasErrorTags,
  isLoadingNiches,
  hasErrorNiches,
}: ProductDetailHeroProps) {
  const navigate = useNavigate();
  const [quoteVariantWizardOpen, setQuoteVariantWizardOpen] = useState(false);

  // ── Word Magic ───────────────────────────────────────────────────────────
  const { displayName, displayDescription, isAIActive } = useWordMagic(product);

  // Categoria-FOLHA (mais específica) + caminho raiz→folha para este produto.
  const { leafById } = useProductLeafCategories([product.id]);
  const leafCategory = leafById.get(product.id);

  const minQuantity = product.minQuantity || 1;
  const stockInfo = getStockStatusInfo(product.stockStatus);

  const { badges: intelBadges } = useProductIntelligenceBadges(id, {
    featured: product.featured,
    new_arrival: product.newArrival,
  });

  // Check if any intel badge indicates best seller or hot item
  const isAutoBestSeller = intelBadges.some(
    (b) => b.type === 'best-seller' || b.type === 'hot-item',
  );

  // Override local (admin-only) tem precedência sobre o valor exposto pelo BD
  // externo. Quando ambos são nulos, o util cai no default de 60 dias.
  const { data: freshnessOverride } = useProductFreshnessOverride(id);
  const effectiveThresholdDays =
    freshnessOverride?.threshold_days ??
    product.priceFreshnessThresholdDays ??
    DEFAULT_PRICE_FRESHNESS_THRESHOLD_DAYS;

  // FIX scroll/sticky no PDP: `overflow-x-hidden` faz o eixo Y colapsar para
  // `overflow-y:auto` (spec CSS), tornando este grid um *scroll container* e
  // (a) quebrando o `lg:sticky lg:top-20` da galeria (passa a ancorar neste
  // container, não no viewport) e (b) confundindo a barra de rolagem da
  // página. `overflow-x-clip` clipa o eixo X sem criar scroll container.
  return (
    <div className="grid min-w-0 gap-4 overflow-x-clip lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 xl:gap-8">
      {/* LEFT — Gallery */}
      <div className="min-w-0">
        <div className="space-y-3 pb-4 lg:sticky lg:top-20">
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
              packagingContext={product.packagingContext ?? null}
              boxWidthMm={product.boxWidthMm}
              boxHeightMm={product.boxHeightMm}
              boxLengthMm={product.boxLengthMm}
              onClick={onOpenPackagingModal}
            />
            {!product.hasCommercialPackaging && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium italic text-muted-foreground/30">
                <Gift className="h-3 w-3 opacity-50" />
                Sem embalagem especial
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ProductCategoryBadges
              category={
                leafCategory
                  ? { id: leafCategory.id, name: leafCategory.name }
                  : (product.category as never)
              }
              groups={product.groups}
              categoryUuid={leafCategory?.id ?? product.category_id}
              categoryPath={leafCategory?.path}
              productId={product.id}
              productName={product.name}
              productSku={product.sku}
              productPrice={product.price}
              productImageUrl={product.images?.[0]}
              productMinQuantity={minQuantity}
              isKit={product.isKit}
            />
          </div>
          <ProductGallery
            images={product.images}
            video={product.video ?? undefined}
            productVideos={product.productVideos as never}
            productName={product.name}
            productId={id}
            productPrice={product.price}
            productSku={product.sku}
            productMinQuantity={product.minQuantity}
            shareUrl={typeof window !== 'undefined' ? window.location.href : undefined}
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
          <h1
            data-testid="page-title-detalhe-produto"
            data-product-name={product.name}
            className={cn("font-display text-lg font-bold leading-tight tracking-tight sm:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl", isAIActive ? "text-violet-700 dark:text-violet-300" : "text-foreground")}
          >
            {displayName}
          </h1>

          {/* Word Magic — botão integrado no cabeçalho do produto */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {isAIActive && (
              <span className="flex items-center gap-1 rounded-full border border-violet-300/60 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                <BookOpen className="h-3 w-3" />
                Texto IA ativo
              </span>
            )}
          </div>

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
                <div className="flex items-baseline gap-1.5" data-testid="pdp-price-row">
                  <span
                    data-testid="pdp-price-value"
                    className="font-display text-[1.40625rem] font-extrabold leading-none tracking-tight text-foreground xl:text-[1.6875rem]"
                  >
                    {formatCurrency(product.price)}
                  </span>
                  <span
                    data-testid="pdp-price-unit"
                    className="text-xs font-medium text-muted-foreground/50"
                  >
                    /un
                  </span>
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
                          <Tooltip key={variation.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setSelectedVariation(variation)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedVariation(variation);
                                  }
                                }}
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
                            </TooltipTrigger>
                            <TooltipContent>
                              {variation.color?.name || 'Cor'}: {stock.toLocaleString('pt-BR')} un.
                            </TooltipContent>
                          </Tooltip>
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
                  className="xl:h-13 font-action-button h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-primary text-[0.875rem] text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                  labelOverride="Carrinho"
                  iconOverride="cart"
                />
                <Button
                  size="lg"
                  className="xl:h-13 font-action-button h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-success text-[0.875rem] text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
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
              <div className="space-y-4 pt-1">
                {intelBadges.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Inteligência de Mercado
                    </p>
                    <IntelligenceBadges badges={intelBadges} className="gap-1.5" />
                  </div>
                )}

                <div className="space-y-2.5">
                  <DynamicTrustBadges
                    trust={
                      supplierTrust ?? { isVerified: false, deliveryDays: null, avgRating: null }
                    }
                    productFlags={{
                      newArrival: product?.newArrival ?? false,
                      onSale: product?.onSale ?? false,
                      featured: (product?.featured || isAutoBestSeller) ?? false,
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
              {displayDescription ? (
                (() => {
                  const sentences = displayDescription
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
                      {displayDescription}
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

          {/* Packaging Summary */}
          {product.hasCommercialPackaging && (
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 xl:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Gift className="h-5 w-5 text-warning" />
                <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">
                  Embalagem Especial
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {product.packingType && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground/70">
                      Tipo
                    </p>
                    <p className="text-xs font-medium">{product.packingType}</p>
                  </div>
                )}
                {product.boxQuantity && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground/70">
                      Qtd/Caixa
                    </p>
                    <p className="text-xs font-medium">{product.boxQuantity} un.</p>
                  </div>
                )}
                {product.boxWeightKg && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground/70">
                      Peso
                    </p>
                    <p className="text-xs font-medium">{product.boxWeightKg} kg</p>
                  </div>
                )}
                {(product.boxWidthMm || product.boxHeightMm || product.boxLengthMm) && (
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground/70">
                      Dimensões
                    </p>
                    <p className="text-xs font-medium">
                      {[product.boxWidthMm, product.boxHeightMm, product.boxLengthMm]
                        .filter(Boolean)
                        .join(' × ')}{' '}
                      mm
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-warning hover:text-warning/80"
                onClick={onOpenPackagingModal}
              >
                Ver todos os detalhes
              </Button>
            </div>
          )}
        </div>

        {/* Kit Composition */}
        {/* Kit nativo do fornecedor: vendido como conjunto único. Componentes NÃO são produtos
            avulsos vendáveis — apenas informativos. Por isso não há navegação inter-produto nem
            preço/estoque por componente. */}
        {product.isKit && product.kitItems && <KitComposition items={product.kitItems} />}

        {/* Quick Actions */}
        <div className="mt-auto">
          <ProductQuickActions
            productId={product.id}
            productName={product.name}
            productSku={product.sku}
            basePrice={product.price}
            minQuantity={minQuantity}
            isLoadingTags={isLoadingTags}
            hasErrorTags={hasErrorTags}
            isLoadingNiches={isLoadingNiches}
            hasErrorNiches={hasErrorNiches}
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
                    variantImages: selectedVariation.images,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
