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
        // BUG-ANALYTICS-VIEW-SILENT-FAIL FIX: bare await swallowed RLS/constraint errors.
        // Supabase JS v2 never throws for DB errors — must destructure { error }.
        const { error: viewErr } = await supabase.from('product_views').insert({
          product_id: productId,
          product_sku: productSku,
          product_name: productName,
          seller_id: user.id,
          view_type: viewType,
        });
        if (viewErr) logger.warn('[analytics] trackProductView insert failed', viewErr);
      } catch (error) {
        logger.warn('[analytics] trackProductView unexpected error', error);
      }
    },
    [user?.id],
  );

  const trackSearch = useCallback(
    async ({ searchTerm, resultsCount }: TrackSearchParams) => {
      if (!user?.id || !searchTerm.trim()) return;

      try {
        // BUG-ANALYTICS-SEARCH-SILENT-FAIL FIX: bare await swallowed RLS/constraint errors.
        const { error: searchErr } = await supabase.from('search_analytics').insert({
          search_term: searchTerm.toLowerCase().trim(),
          results_count: resultsCount,
          user_id: user.id,
        });
        if (searchErr) logger.warn('[analytics] trackSearch insert failed', searchErr);
      } catch (error) {
        logger.warn('[analytics] trackSearch unexpected error', error);
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
        // BUG-ANALYTICS-SORT-SILENT-FAIL FIX: bare await swallowed RLS/constraint errors.
        const { error: sortErr } = await supabase.from('catalog_analytics').insert({
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
        if (sortErr) logger.warn('[analytics] trackSort insert failed', sortErr);
      } catch (error) {
        logger.warn('[analytics] trackSort unexpected error', error);
      }
    },
    [user?.id],
  );

  return { trackProductView, trackSearch, trackSort };
}
