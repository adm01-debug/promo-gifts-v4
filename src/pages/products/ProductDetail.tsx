import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageSEO } from "@/components/seo/PageSEO";
import { getCdnUrl } from '@/utils/image-utils';
import { ProductStickyHeader } from '@/components/products/ProductStickyHeader';
import { SimilarProducts } from '@/components/products/SimilarProducts';
import { SmartRecommendations } from '@/components/products/SmartRecommendations';
import { useSimilarProducts } from '@/hooks/products';
import type { ProductForRecommendation } from '@/hooks/intelligence';
import { StockHistoryChart } from '@/components/products/StockHistoryChart';
import { SalesHistoryChart } from '@/components/products/SalesHistoryChart';
import { SupplierComparisonModal } from '@/components/compare/SupplierComparisonModal';
import { VariantPickerDialog } from '@/components/products/VariantPickerDialog';
import { FutureStockModal } from '@/components/products/FutureStockModal';
import { PackagingModal } from '@/components/products/PackagingModal';
import { useToast } from '@/hooks/ui';
import { useProductAnalytics } from '@/hooks/products';
import { useProduct } from '@/hooks/products';
import type { Product, ProductVariation } from '@/types/product-catalog';
import type { ExternalVariantStock } from '@/hooks/products';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductDetailSkeleton } from '@/components/products/ProductDetailSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { IntelligenceBadges } from '@/components/common/IntelligenceBadges';
import { useProductIntelligenceBadges } from '@/hooks/products';
import { useSupplierTrust } from '@/hooks/products';
import { FloatingCompareBar } from '@/components/compare/FloatingCompareBar';
import { MobileProductActions } from '@/components/mobile/MobileProductActions';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { ProductDetailHero } from "@/pages/products/product-detail/ProductDetailHero";
import { ScrollToTopButton } from '@/components/common/ScrollToTopButton';
import { formatCurrency } from '@/lib/format';


export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { trackProductView } = useProductAnalytics();

  const { isFavorite: isFavoriteCheck, toggleFavorite, removeFavorite } = useFavoritesStore();
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [favPickerOpen, setFavPickerOpen] = useState(false);
  const [colorAutoSelected, setColorAutoSelected] = useState(false);
  const [supplierCompareOpen, setSupplierCompareOpen] = useState(false);
  const [futureStockOpen, setFutureStockOpen] = useState(false);
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const { addToRecentlyViewed } = useRecentlyViewedStore();

  const { data, isLoading, isError } = useProduct(id || '');
  const product: Product | null | undefined = data;
  const { data: supplierTrust } = useSupplierTrust(id);
  const { data: similarItems = [] } = useSimilarProducts(product);
  const aiCandidates = useMemo<ProductForRecommendation[]>(
    () =>
      similarItems.slice(0, 12).map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category_name || product?.category?.name || 'Brindes',
        priceRange: formatCurrency(it.price),
        tags: [it.supplier_name].filter(Boolean) as string[],
      })),
    [similarItems, product?.category?.name],
  );
  const catalogFlags = useMemo(
    () =>
      product
        ? {
            featured: product.featured,
            newArrival: product.newArrival,
            onSale: product.onSale,
            lowStock: product.stockStatus === 'low-stock',
            stock: product.stock,
          }
        : undefined,
    [product?.featured, product?.newArrival, product?.onSale, product?.stockStatus, product?.stock], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const {
    badges: intellBadges,
    turnoverScore: intellTurnover,
    isDemo: intellIsDemo,
  } = useProductIntelligenceBadges(id, catalogFlags);

  const { data: viewCount = 0 } = useQuery({
    queryKey: ['product-views-count', id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count } = await supabase
        .from('product_views')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id ?? '')
        .gte('created_at', thirtyDaysAgo.toISOString());
      return count || 0;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (product) {
      trackProductView({
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        viewType: 'detail',
      });
      addToRecentlyViewed(product.id);
    }
  }, [product, trackProductView, addToRecentlyViewed]);

  // Auto-select color from URL
  useEffect(() => {
    if (!product || colorAutoSelected) return;
    const corParam = searchParams.get('cor');
    const grupoParam = searchParams.get('grupo');
    const hexParam = searchParams.get('hex');
    if ((!corParam && !grupoParam && !hexParam) || !product.variations?.length) return;
    const normalizedParam = corParam?.toLowerCase().trim() || '';
    let match = product.variations.find(
      (v: ProductVariation) => v.color?.name?.toLowerCase().trim() === normalizedParam,
    );
    if (!match && normalizedParam)
      match = product.variations.find((v: ProductVariation) => {
        const name = v.color?.name?.toLowerCase().trim() || '';
        return name.includes(normalizedParam) || normalizedParam.includes(name);
      });
    if (!match && hexParam)
      match = product.variations.find(
        (v: ProductVariation) => v.color?.hex?.toLowerCase() === hexParam.toLowerCase(),
      );
    if (!match && grupoParam && product.colors?.length) {
      const c = product.colors.find(
        (c: { groupSlug?: string; name?: string }) => c.groupSlug === grupoParam,
      );
      if (c)
        match = product.variations.find(
          (v: ProductVariation) => v.color?.name?.toLowerCase() === c.name?.toLowerCase(),
        );
    }
    if (match) setSelectedVariation(match);
    setColorAutoSelected(true);
  }, [product, searchParams, colorAutoSelected]);

  // Sync URL on variation change
  useEffect(() => {
    if (!product || !colorAutoSelected) return;
    const currentCor = searchParams.get('cor') || '';
    const currentHex = searchParams.get('hex') || '';
    const newCor = selectedVariation?.color?.name || '';
    const newHex = selectedVariation?.color?.hex || '';
    if (currentCor === newCor && currentHex === newHex) return;
    const newParams = new URLSearchParams(searchParams);
    if (newCor) {
      newParams.set('cor', newCor);
      if (newHex) newParams.set('hex', newHex);
      else newParams.delete('hex');
      newParams.delete('grupo');
    } else {
      newParams.delete('cor');
      newParams.delete('hex');
      newParams.delete('grupo');
    }
    setSearchParams(newParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariation, colorAutoSelected]);

  if (isLoading)
    return (
        <ProductDetailSkeleton />
    );

  if (isError || !product) {
    return (
        <EmptyState
          variant="products"
          title={isError ? 'Erro ao carregar produto' : 'Produto não encontrado'}
          description={
            isError
              ? 'Não foi possível carregar os dados do produto.'
              : 'O produto não existe ou foi removido.'
          }
          action={{
            label: isError ? 'Tentar novamente' : 'Voltar para Vitrine',
            onClick: () => (isError ? window.location.reload() : navigate('/')),
          }}
        />
    );
  }

  const isFavorite = id ? isFavoriteCheck(id) : false;
  const handleFavorite = () => {
    if (!id) return;
    if (isFavorite) {
      removeFavorite(id);
      toast({ title: 'Removido dos favoritos', description: product.name });
    } else setFavPickerOpen(true);
  };
  const handleFavoriteVariantSelected = (variant: ExternalVariantStock | null) => {
    if (!id) return;
    toggleFavorite(
      id,
      variant
        ? {
            color_name: variant.color_name,
            color_hex: variant.color_hex,
            size_code: variant.size_code,
            variant_id: variant.variant_id,
            thumbnail: variant.thumbnail,
          }
        : undefined,
    );
    toast({ title: 'Adicionado aos favoritos', description: product.name });
  };

  return (
    <>
      <PageSEO
        title={`${product.name} | Promo Gifts`}
        description={product.description || `${product.name} - Brinde Promocional`}
        path={`/produto/${product.id}`}
        ogImage={
          product.og_image_url
            ? getCdnUrl(product.og_image_url, 'large')
            : product.images[0] || ''
        }
        ogType="product"
      />
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description || `${product.name} - Brinde Promocional`,
          sku: product.sku,
          image: product.images?.filter(Boolean) || [],
          brand: { '@type': 'Brand', name: product.supplier?.name || 'Promo Gifts' },
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'BRL',
            availability:
              product.stockStatus === 'in-stock'
                ? 'https://schema.org/InStock'
                : product.stockStatus === 'out-of-stock'
                  ? 'https://schema.org/OutOfStock'
                  : 'https://schema.org/LimitedAvailability',
            seller: { '@type': 'Organization', name: 'Promo Gifts' },
          },
          category: product.category?.name,
          material: product.materials?.join(', '),
        })}
      </script>

      <ProductStickyHeader
        productId={product.id}
        productName={product.name}
        productSku={product.sku}
        productPrice={product.price}
        productImage={product.images?.[0] || '/placeholder.svg'}
        minQuantity={product.minQuantity || 1}
        isFavorite={isFavorite}
        onToggleFavorite={handleFavorite}
        product={product}
      />

      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-4 animate-fade-in">
        <IntelligenceBadges
          badges={intellBadges}
          turnoverScore={intellTurnover}
          isDemo={intellIsDemo}
        />

        <ProductDetailHero
          product={product}
          id={id || ''}
          selectedVariation={selectedVariation}
          setSelectedVariation={setSelectedVariation}
          isFavorite={isFavorite}
          onToggleFavorite={handleFavorite}
          viewCount={viewCount}
          supplierTrust={supplierTrust}
          onOpenPackagingModal={() => setPackagingModalOpen(true)}
          onOpenFutureStock={() => setFutureStockOpen(true)}
          onOpenSupplierComparison={() => setSupplierCompareOpen(true)}
        />

        <div className="border-t border-border/60 pt-6 xl:pt-8">
          <SimilarProducts currentProduct={product} />
        </div>

        {aiCandidates.length > 0 && (
          <div className="border-t border-border/60 pt-6 xl:pt-8">
            <SmartRecommendations
              currentProductId={product.id}
              candidateProducts={aiCandidates}
              maxResults={6}
              title="Recomendações inteligentes para este produto"
              onProductClick={(pid) => navigate(`/produto/${pid}`)}
            />
          </div>
        )}

        <div className="grid gap-4 border-t border-border/60 pt-6 md:grid-cols-2 xl:gap-6 xl:pt-8">
          <StockHistoryChart productId={product.id} productName={product.name} />
          <SalesHistoryChart
            productId={product.id}
            productSku={product.sku}
            productName={product.name}
          />
        </div>

        <SupplierComparisonModal
          product={product}
          open={supplierCompareOpen}
          onOpenChange={setSupplierCompareOpen}
        />
        <FutureStockModal
          open={futureStockOpen}
          onOpenChange={setFutureStockOpen}
          productId={product.id}
          productName={product.name}
          productSku={product.sku}
        />
        <PackagingModal
          isOpen={packagingModalOpen}
          onClose={() => setPackagingModalOpen(false)}
          packingType={
            product.packagingContext === 'with_customization'
              ? product.repackingType || product.packingType
              : product.packingType
          }
          packagingContext={product.packagingContext}
          boxImage={product.boxImage}
          boxWidthMm={product.boxWidthMm}
          boxHeightMm={product.boxHeightMm}
          boxLengthMm={product.boxLengthMm}
          boxWeightKg={product.boxWeightKg}
          boxQuantity={product.boxQuantity}
          boxVolumeCm3={product.boxVolumeCm3}
        />
      </div>

      <FloatingCompareBar />
      <MobileProductActions
        productId={product.id}
        productName={product.name}
        productSku={product.sku}
        productPrice={product.price}
        productImageUrl={product.images?.[0]}
        minQuantity={product.minQuantity || 1}
        isFavorite={isFavorite}
        onToggleFavorite={handleFavorite}
        product={product}
      />

      {id && (
        <VariantPickerDialog
          open={favPickerOpen}
          onOpenChange={setFavPickerOpen}
          productId={id}
          productName={product.name}
          mode="favorite"
          onComplete={handleFavoriteVariantSelected}
        />
      )}
      <ScrollToTopButton />
    </>
  );
}
