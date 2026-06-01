/**
 * Caches the ElevenLabs Scribe token to avoid fetching on every activation.
 * Tokens expire after 15 minutes; we cache for 12 minutes to be safe.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const CACHE_TTL_MS = 12 * 60 * 1000; // 12 minutes

let cachedToken: string | null = null;
let cachedAt = 0;
let pendingFetch: Promise<string | null> | null = null;

export async function getScribeToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && now - cachedAt < CACHE_TTL_MS) {
    logger.log('[Voice] Using cached Scribe token');
    return cachedToken;
  }

  // Deduplicate concurrent requests
  if (pendingFetch) {
    logger.log('[Voice] Waiting for in-flight token fetch');
    const result = await pendingFetch;
    if (result) return result;
    throw new Error('Token fetch failed');
  }

  pendingFetch = fetchToken();
  try {
    const token = await pendingFetch;
    if (!token) throw new Error('No token received');
    return token;
  } finally {
    pendingFetch = null;
  }
}

async function fetchToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token');
    if (error || !data?.token) {
      logger.warn('[Voice] Failed to fetch Scribe token:', error);
      cachedToken = null;
      return null;
    }

    cachedToken = data.token;
    cachedAt = Date.now();
    logger.log('[Voice] Scribe token cached for 12 minutes');
    return cachedToken;
  } catch (err) {
    logger.warn('[Voice] Token fetch error:', err);
    cachedToken = null;
    return null;
  }
}

export function invalidateScribeTokenCache(): void {
  cachedToken = null;
  cachedAt = 0;
}
