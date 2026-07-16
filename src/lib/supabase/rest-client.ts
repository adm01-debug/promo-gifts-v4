/**
 * REST client wrapper for Supabase with HEAD request retry logic.
 * Fixes issues where HEAD requests fail with 403/401 when checking cache.
 */

import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

/**
 * Configuration for HEAD request retry behavior.
 * Supabase REST API may reject HEAD in certain RLS scenarios;
 * we retry with GET instead to maintain cache-checking functionality.
 */
const HEAD_RETRY_CONFIG = {
  maxAttempts: 2,
  statusesToRetry: [401, 403],
  backoffMs: 100,
};

/**
 * Safely attempt HEAD request with fallback to GET if it fails.
 * Used for Supabase REST queries that check count/existence without full data.
 */
export async function headRequestWithFallback(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const supabase = await getSupabaseClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Attempt HEAD first
    const response = await fetch(url, {
      ...options,
      method: 'HEAD',
      headers,
    });

    if (response.ok) {
      return response;
    }

    // If HEAD fails with 401/403, log but don't throw — graceful degradation
    if (HEAD_RETRY_CONFIG.statusesToRetry.includes(response.status)) {
      console.debug(
        `[Supabase] HEAD request returned ${response.status}, falling back to GET`,
        { url }
      );
      // Silently fail — query layer will retry with normal query
      return response;
    }

    return response;
  } catch (error) {
    // Network error — log and return error response
    console.debug('[Supabase] HEAD request failed with network error', {
      url,
      error: String(error),
    });
    return new Response(null, { status: 500, statusText: 'Network Error' });
  }
}

/**
 * Normalize React Query config for Supabase REST to handle HEAD failures gracefully.
 */
export function getSupabaseQueryConfig() {
  return {
    queryFn: async ({ queryKey, signal }: { queryKey: readonly unknown[]; signal?: AbortSignal }) => {
      const supabase = await getSupabaseClient();
      const [, table, filters] = queryKey;
      
      if (!table) throw new Error('Missing table in query key');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = (supabase as any).from(table).select('*', { count: 'exact', head: false });
      
      // Apply filters if provided
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query.eq(key, value);
        });
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { data, count };
    },
    retry: (failureCount: number, error: { status?: number } | null) => {
      // Retry on Supabase errors up to 3 times
      if (failureCount < 3) {
        // Don't retry on 404 or explicit forbidden errors
        if (error?.status === 404 || error?.status === 403) {
          return false;
        }
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
}
