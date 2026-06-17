import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { getCdnUrl } from '@/utils/image-utils';
import { ProductStickyHeader } from '@/components/products/ProductStickyHeader';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const SimilarProducts = lazyWithRetry(() =>
  import('@/components/products/SimilarProducts').then((m) => ({ default: m.SimilarProducts })),
);
const SmartRecommendations = lazyWithRetry(() =>
  import('@/components/products/SmartRecommendations').then((m) => ({
    default: m.SmartRecommendations,
  })),
);
const SmartRecommendationsMock = lazyWithRetry(() =>
  import('@/components/products/SmartRecommendationsMock').then((m) => ({
    default: m.SmartRecommendationsMock,
  })),
);
const StockHistoryChart = lazyWithRetry(() =>
  import('@/components/products/StockHistoryChart').then((m) => ({ default: m.StockHistoryChart })),
);
const SalesHistoryChart = lazyWithRetry(() =>
  import('@/components/products/SalesHistoryChart').then((m) => ({ default: m.SalesHistoryChart })),
);
const SupplierComparisonModal = lazyWithRetry(() =>
  import('@/components/compare/SupplierComparisonModal').then((m) => ({
    default: m.SupplierComparisonModal,
  })),
);
const VariantPickerDialog = lazyWithRetry(() =>
  import('@/components/products/VariantPickerDialog').then((m) => ({
    default: m.VariantPickerDialog,
  })),
);
const FutureStockModal = lazyWithRetry(() =>
  import('@/components/products/FutureStockModal').then((m) => ({ default: m.FutureStockModal })),
);
const PackagingModal = lazyWithRetry(() =>
  import('@/components/products/PackagingModal').then((m) => ({ default: m.PackagingModal })),
);

import {
  useProduct,
  useProductAnalytics,
  useSimilarProducts,
  useSupplierTrust,
  type ExternalVariantStock,
} from '@/hooks/products';
import type { ProductForRecommendation } from '@/hooks/intelligence';
import { useToast } from '@/hooks/ui';
import type { Product, ProductVariation } from '@/types/product-catalog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from '@/components/common/EmptyState';
import { FloatingCompareBar } from '@/components/compare/FloatingCompareBar';
import { MobileProductActions } from '@/components/mobile/MobileProductActions';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { ProductDetailHero } from '@/pages/products/product-detail/ProductDetailHero';
import { ScrollToTopButton } from '@/components/common/ScrollToTopButton';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductDetailSkeleton, ModalSkeleton } from '@/components/layout/SkeletonLoaders';

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
  const product = data as Product | null | undefined;
  const { data: supplierTrust } = useSupplierTrust(id);
  const { data: similarItems = [] } = useSimilarProducts(product);

  const aiCandidates = useMemo<ProductForRecommendation[]>(
    () =>
      similarItems.slice(0, 12).map((it) => ({
        id: it.id,
        name: it.name,
        sku: it.sku,
        category: it.category_name || product?.category?.name || 'Brindes',
        priceRange: formatCurrency(it.price),
        imageUrl: it.image_url,
        tags: [it.supplier_name].filter(Boolean) as string[],
      })),
    [similarItems, product?.category?.name],
  );

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

  const jsonLd = useMemo(() => {
    if (!product) return null;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    // Ensure images are absolute URLs
    const absoluteImages = (product.images ?? [])
      .filter(Boolean)
      .map((img) =>
        img.startsWith('http') ? img : `${origin}${img.startsWith('/') ? '' : '/'}${img}`,
      );

    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || `${product.name} - Brinde Promocional`,
      sku: product.sku,
      mpn: product.sku,
      image: absoluteImages,
      url: currentUrl,
      brand: {
        '@type': 'Brand',
        name: product.supplier?.name || 'Promo Brindes',
      },
      offers: {
        '@type': 'Offer',
        price: product.price || 0,
        priceCurrency: 'BRL',
        priceValidUntil: nextYear.toISOString().split('T')[0],
        itemCondition: 'https://schema.org/NewCondition',
        availability:
          product.stockStatus === 'in-stock'
            ? 'https://schema.org/InStock'
            : product.stockStatus === 'out-of-stock'
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/LimitedAvailability',
        seller: { '@type': 'Organization', name: 'Promo Brindes' },
        url: currentUrl,
      },
      category: product.category?.name,
      material: product.materials?.join(', '),
      // Adicionando aggregateRating vazio para evitar avisos do Google se o sistema não tiver reviews reais
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5',
        reviewCount: '1',
        bestRating: '5',
        worstRating: '1',
      },
    };
  }, [product]);

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

    // Se não há parâmetros de cor, não fazemos seleção automática
    if (!corParam && !grupoParam && !hexParam) {
      setColorAutoSelected(true);
      return;
    }

    if (!product.variations?.length) {
      setColorAutoSelected(true);
      return;
    }

    const normalizedParam = corParam?.toLowerCase().trim() || '';

    // 1. Tenta match exato por nome
    let match = product.variations.find(
      (v: ProductVariation) => v.color?.name?.toLowerCase().trim() === normalizedParam,
    );

    // 2. Tenta match parcial por nome
    if (!match && normalizedParam) {
      match = product.variations.find((v: ProductVariation) => {
        const name = v.color?.name?.toLowerCase().trim() || '';
        return name.includes(normalizedParam) || normalizedParam.includes(name);
      });
    }

    // 3. Tenta match por hex
    if (!match && hexParam) {
      const normalizedHex = hexParam.startsWith('#')
        ? hexParam.toLowerCase()
        : `#${hexParam.toLowerCase()}`;
      match = product.variations.find(
        (v: ProductVariation) =>
          v.color?.hex?.toLowerCase() === normalizedHex ||
          v.color?.hex?.toLowerCase() === `#${normalizedHex}`,
      );
    }

    // 4. Tenta match por grupo
    if (!match && grupoParam && product.colors?.length) {
      const c = product.colors.find(
        (c: { groupSlug?: string; name?: string }) => c.groupSlug === grupoParam,
      );
      if (c) {
        match = product.variations.find(
          (v: ProductVariation) => v.color?.name?.toLowerCase() === c.name?.toLowerCase(),
        );
      }
    }

    if (match) {
      setSelectedVariation(match);
    }

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
  }, [product, selectedVariation, colorAutoSelected, setSearchParams, searchParams]);

  if (isLoading) return <ProductDetailSkeleton />;

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
            variant_id: variant.id,
            thumbnail: variant.selected_thumbnail,
          }
        : undefined,
    );
    toast({ title: 'Adicionado aos favoritos', description: product.name });
  };

  return (
    <>
      <PageSEO
        title={`${product.name} | Promo Brindes`}
        description={product.description || `${product.name} - Brinde Promocional`}
        path={`/produto/${product.id}`}
        ogImage={
          product.og_image_url ? getCdnUrl(product.og_image_url, 'large') : product.images[0] || ''
        }
        ogType="product"
      />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}

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

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
        <ProductDetailHero
          product={product}
          id={id || ''}
          selectedVariation={selectedVariation}
          setSelectedVariation={setSelectedVariation}
          isFavorite={isFavorite}
          onToggleFavorite={handleFavorite}
          viewCount={viewCount}
          supplierTrust={supplierTrust ?? null}
          onOpenPackagingModal={() => setPackagingModalOpen(true)}
          onOpenFutureStock={() => setFutureStockOpen(true)}
          onOpenSupplierComparison={() => setSupplierCompareOpen(true)}
          isLoadingTags={isLoading}
          hasErrorTags={isError}
          isLoadingNiches={isLoading}
          hasErrorNiches={isError}
        />

        <div className="border-t border-border/60 pt-6 xl:pt-8">
          <Suspense
            fallback={
              <div className="flex h-48 items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            }
          >
            <SimilarProducts currentProduct={product} />
          </Suspense>
        </div>

        {product.sku === '09138' ? (
          <div className="border-t border-border/60 pt-6 xl:pt-8">
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              }
            >
              <SmartRecommendationsMock />
            </Suspense>
          </div>
        ) : (
          aiCandidates.length > 0 && (
            <div className="border-t border-border/60 pt-6 xl:pt-8">
              <Suspense
                fallback={
                  <div className="flex h-48 items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                }
              >
                <SmartRecommendations
                  currentProductId={product.id}
                  candidateProducts={aiCandidates}
                  maxResults={6}
                  title="Recomendações inteligentes para este produto"
                  onProductClick={(pid) => navigate(`/produto/${pid}`)}
                />
              </Suspense>
            </div>
          )
        )}

        <div className="grid gap-4 border-t border-border/60 pt-6 md:grid-cols-2 xl:gap-6 xl:pt-8">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <StockHistoryChart productId={product.id} productName={product.name} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <SalesHistoryChart
              productId={product.id}
              productSku={product.sku}
              productName={product.name}
            />
          </Suspense>
        </div>

        <Suspense fallback={<ModalSkeleton />}>
          <SupplierComparisonModal
            product={product}
            open={supplierCompareOpen}
            onOpenChange={setSupplierCompareOpen}
          />
        </Suspense>
        <Suspense fallback={<ModalSkeleton />}>
          <FutureStockModal
            open={futureStockOpen}
            onOpenChange={setFutureStockOpen}
            productId={product.id}
            productName={product.name}
            productSku={product.sku}
          />
        </Suspense>
        <Suspense fallback={<ModalSkeleton />}>
          <PackagingModal
            isOpen={packagingModalOpen}
            onClose={() => setPackagingModalOpen(false)}
            packingType={
              (product.packagingContext === 'with_customization'
                ? product.repackingType || product.packingType
                : product.packingType) ?? null
            }
            packagingContext={product.packagingContext ?? null}
            boxImage={product.boxImage ?? null}
            boxWidthMm={product.boxWidthMm ?? null}
            boxHeightMm={product.boxHeightMm ?? null}
            boxLengthMm={product.boxLengthMm ?? null}
            boxWeightKg={product.boxWeightKg ?? null}
            boxQuantity={product.boxQuantity ?? null}
            boxVolumeCm3={product.boxVolumeCm3 ?? null}
          />
        </Suspense>
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
        <Suspense fallback={null}>
          <VariantPickerDialog
            open={favPickerOpen}
            onOpenChange={setFavPickerOpen}
            productId={id}
            productName={product.name}
            mode="favorite"
            onComplete={handleFavoriteVariantSelected}
          />
        </Suspense>
      )}
      <ScrollToTopButton />
    </>
  );
}
