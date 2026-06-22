import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

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
        // Best-effort insert - must NOT affect UX, but failures are logged for observability
        await supabase.from('product_views').insert({
          product_id: productId,
          product_sku: productSku,
          product_name: productName,
          seller_id: user.id,
          view_type: viewType,
        });
      } catch (error) {
        // Best-effort analytics: never block UX, but surface the failure (was silently swallowed).
        logger.warn('[analytics] trackProductView insert failed', error);
      }
    },
    [user?.id],
  );

  const trackSearch = useCallback(
    async ({ searchTerm, resultsCount }: TrackSearchParams) => {
      if (!user?.id || !searchTerm.trim()) return;

      try {
        // Best-effort insert - must NOT affect UX, but failures are logged for observability
        await supabase.from('search_analytics').insert({
          search_term: searchTerm.toLowerCase().trim(),
          results_count: resultsCount,
          user_id: user.id,
        });
      } catch (error) {
        // Best-effort analytics: never block UX, but surface the failure (was silently swallowed).
        logger.warn('[analytics] trackSearch insert failed', error);
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
      } catch (error) {
        // Best-effort analytics: never block UX, but surface the failure (was silently swallowed).
        logger.warn('[analytics] trackSort insert failed', error);
      }
    },
    [user?.id],
  );

  return { trackProductView, trackSearch, trackSort };
}
