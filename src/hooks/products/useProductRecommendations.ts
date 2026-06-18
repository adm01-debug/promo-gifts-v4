import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PromobrindProduct } from '@/lib/external-db';

import { logger } from '@/lib/logger';
// Re-export extracted hooks for backwards compatibility
export { useProductInsights } from '@/hooks/products/useProductInsights';
export { useClientTopProducts } from '@/hooks/crm/useClientTopProducts';

interface ProductRecommendation {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[] | string | null;
  category_id: string | null;
  score: number;
  reason: string;
}

interface ProductCount {
  sku: string | null;
  name: string;
  image: string | null;
  price: number;
  count: number;
}

interface FrequentlyBoughtTogether {
  productId: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  timesOrderedTogether: number;
  price: number;
}

export function useProductRecommendations(productId?: string, productSku?: string) {
  const { user } = useAuth();

  const frequentlyBoughtTogether = useQuery({
    queryKey: ['product-frequently-bought', productSku],
    queryFn: async (): Promise<FrequentlyBoughtTogether[]> => {
      if (!productSku) return [];

      const { data: ordersWithProduct, error: ordersError } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('product_sku', productSku);

      if (ordersError || !ordersWithProduct?.length) return [];

      const orderIds = ordersWithProduct.map((o) => o.order_id);

      const { data: relatedItems, error: relatedError } = await supabase
        .from('order_items')
        .select('product_id, product_sku, product_name, product_image_url, unit_price')
        .in('order_id', orderIds)
        .neq('product_sku', productSku);

      if (relatedError || !relatedItems?.length) return [];

      const productCounts = relatedItems.reduce(
        (acc, item) => {
          const key = item.product_sku || item.product_id;
          if (!key) return acc;

          if (!acc[key]) {
            acc[key] = {
              productId: item.product_id ?? '',
              productName: item.product_name ?? '',
              productSku: item.product_sku ?? '',
              productImage: item.product_image_url,
              timesOrderedTogether: 0,
              price: item.unit_price ?? 0,
            };
          }
          acc[key].timesOrderedTogether++;
          return acc;
        },
        {} as Record<string, FrequentlyBoughtTogether>,
      );

      return Object.values(productCounts)
        .sort((a, b) => b.timesOrderedTogether - a.timesOrderedTogether)
        .slice(0, 5);
    },
    enabled: !!productSku,
    staleTime: 10 * 60 * 1000,
  });

  const personalizedRecommendations = useQuery({
    queryKey: ['product-personalized', user?.id],
    queryFn: async (): Promise<ProductRecommendation[]> => {
      if (!user?.id) return [];

      const { data: recentViews, error: viewsError } = await supabase
        .from('product_views')
        .select('product_id, product_sku, product_name')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (viewsError) return [];

      const viewedSkus = recentViews?.map((v) => v.product_sku).filter(Boolean) ?? [];

      try {
        const { fetchPromobrindProducts, getProductPrice, getProductImageUrl } =
          await import('@/lib/external-db');
        const productsData = await fetchPromobrindProducts({ limit: 100 });

        const mapProduct = (p: PromobrindProduct, score: number, reason: string) => {
          const imageUrl = getProductImageUrl(p);
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: getProductPrice(p),
            images: imageUrl ? [imageUrl] : p.images,
            category_id: p.category_id || p.main_category_id,
            score,
            reason,
          };
        };

        if (viewedSkus.length === 0) {
          return productsData.slice(0, 6).map((p) => mapProduct(p, 50, 'Produto em destaque'));
        }

        const viewedCategories = [
          ...new Set(
            viewedSkus
              .map((sku) => {
                const product = productsData.find((p) => p.sku === sku);
                return product?.category_id || product?.main_category_id;
              })
              .filter(Boolean),
          ),
        ];

        if (viewedCategories.length === 0) {
          return productsData.slice(0, 6).map((p) => mapProduct(p, 60, 'Sugestão'));
        }

        return productsData
          .filter((p) => {
            const catId = p.category_id || p.main_category_id;
            return catId && viewedCategories.includes(catId) && !viewedSkus.includes(p.sku);
          })
          .slice(0, 6)
          .map((p) => mapProduct(p, 80, 'Baseado no seu histórico'));
      } catch (error) {
        logger.error('Error fetching recommendations:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const trendingProducts = useQuery({
    queryKey: ['product-trending'],
    queryFn: async (): Promise<ProductRecommendation[]> => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentQuoteItems, error } = await supabase
        .from('quote_items')
        .select('product_sku, product_name, product_image_url, unit_price')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error || !recentQuoteItems?.length) return [];

      const productCounts = recentQuoteItems.reduce(
        (acc, item) => {
          const key = item.product_sku || item.product_name;
          if (!acc[key]) {
            acc[key] = {
              sku: item.product_sku,
              name: item.product_name,
              image: item.product_image_url,
              price: item.unit_price,
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        },
        {} as Record<string, ProductCount>,
      );

      const sorted = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const skus = sorted.map((p) => p.sku).filter(Boolean) as string[];
      if (skus.length === 0) return [];

      try {
        const { fetchPromobrindProducts, getProductPrice, getProductImageUrl } =
          await import('@/lib/external-db');
        const productsData = await fetchPromobrindProducts({ limit: 500 });
        const matchedProducts = productsData.filter((p) => skus.includes(p.sku));

        return matchedProducts.map((p) => {
          const imageUrl = getProductImageUrl(p);
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: getProductPrice(p),
            images: imageUrl ? [imageUrl] : p.images,
            category_id: p.category_id || p.main_category_id,
            score: 90,
            reason: 'Em alta nas cotações',
          };
        });
      } catch (error) {
        logger.error('Error fetching trending products:', error);
        return [];
      }
    },
    staleTime: 15 * 60 * 1000,
  });

  return {
    frequentlyBoughtTogether,
    personalizedRecommendations,
    trendingProducts,
    isLoading:
      frequentlyBoughtTogether.isLoading ||
      personalizedRecommendations.isLoading ||
      trendingProducts.isLoading,
  };
}
