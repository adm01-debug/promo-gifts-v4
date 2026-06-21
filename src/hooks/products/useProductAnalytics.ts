import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TrackViewParams {
  productId?: string;
  productSku?: string;
  productName: string;
  viewType: 'card' | 'compare' | 'detail' | 'favorite';
}

interface TrackSearchParams {
  searchTerm: string;
  resultsCount: number;
  filtersUsed?: Record<string, unknown>;
}

interface TrackSortParams {
  sortBy: string;
  previousSortBy?: string;
  resultsCount: number;
  hasSearch: boolean;
}

export function useProductAnalytics() {
  const { user } = useAuth();

  const trackProductView = useCallback(
    async ({ productId, productSku, productName, viewType }: TrackViewParams) => {
      if (!user?.id) return;

      try {
        // Using type assertion since table was just created
        // Silently insert - all errors are ignored for analytics to not affect UX
        await supabase.from('product_views').insert({
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
    async ({ searchTerm, resultsCount }: TrackSearchParams) => {
      if (!user?.id || !searchTerm.trim()) return;

      try {
        // Silently insert - all errors are ignored for analytics to not affect UX
        await supabase.from('search_analytics').insert({
          search_term: searchTerm.toLowerCase().trim(),
          results_count: resultsCount,
          user_id: user.id,
        });
        // Note: We intentionally ignore ALL errors for analytics
      } catch {
        // Silently ignore all tracking errors
      }
    },
    [user?.id],
  );

  /**
   * trackSort — Records sort events in catalog_analytics table.
   */
  const trackSort = useCallback(
    async ({ sortBy, previousSortBy, resultsCount, hasSearch }: TrackSortParams) => {
      if (!user?.id) return;

      try {
        await supabase.from('catalog_analytics').insert({
          user_id: user.id,
          event_type: 'sort',
          event_data: {
            sortBy,
            previousSortBy,
            resultsCount,
            hasSearch,
            url: window.location.href,
          },
        });
      } catch {
        // Silently ignore all tracking errors
      }
    },
    [user?.id],
  );

  return { trackProductView, trackSearch, trackSort };
}
