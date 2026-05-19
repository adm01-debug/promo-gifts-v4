import { useCallback } from 'react';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useAuth } from '@/contexts/AuthContext';

interface TrackViewParams {
  productId?: string;
  productSku?: string;
  productName: string;
  viewType: 'detail' | 'card' | 'compare' | 'favorite';
}

interface TrackSearchParams {
  searchTerm: string;
  resultsCount: number;
  filtersUsed?: Record<string, unknown>;
}

export function useProductAnalytics() {
  const { user } = useAuth();

  const trackProductView = useCallback(
    async ({ productId, productSku, productName, viewType }: TrackViewParams) => {
      if (!user?.id) return;

      try {
        // Using type assertion since table was just created
        // Silently insert - all errors are ignored for analytics to not affect UX
        await untypedFrom('product_views').insert({
          product_id: productId,
          product_sku: productSku,
          product_name: productName,
          seller_id: user.id,
          view_type: viewType,
        });
        // Note: We intentionally ignore ALL errors (including 409/23505 conflicts and RLS errors)
        // Analytics should never block or affect user experience
      } catch {
        // Silently ignore all tracking errors
      }
    },
    [user?.id],
  );

  const trackSearch = useCallback(
    async ({ searchTerm, resultsCount, filtersUsed = {} }: TrackSearchParams) => {
      if (!user?.id || !searchTerm.trim()) return;

      try {
        // Silently insert - all errors are ignored for analytics to not affect UX
        await untypedFrom('search_analytics').insert({
          search_term: searchTerm.toLowerCase().trim(),
          results_count: resultsCount,
          seller_id: user.id,
          filters_used: filtersUsed,
        });
        // Note: We intentionally ignore ALL errors for analytics
      } catch {
        // Silently ignore all tracking errors
      }
    },
    [user?.id],
  );

  return { trackProductView, trackSearch };
}
