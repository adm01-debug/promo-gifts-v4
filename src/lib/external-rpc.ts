/**
 * Módulo compartilhado para invocar RPCs no banco externo Promobrind.
 *
 * FIX-BRIDGE-01 (2026-06-01): migrated from supabase.functions.invoke('external-db-bridge')
 * to supabase.rpc() direct calls. Bridge is permanently OFF (kill-switch enabled=false).
 * RPCs listed in rpc-native.ts are routed to PostgREST natively.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 800;
const RETRYABLE_PATTERNS = [
  'statement timeout',
  '57014',
  '502',
  '503',
  '504',
  'network',
  'fetch',
  'ECONNRESET',
  'socket hang up',
  'AbortError',
  'Failed to fetch',
];

function isRetryableError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return RETRYABLE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Invoca uma RPC no banco externo via supabase.rpc() (REST nativo).
 * Retry automático (3x, backoff exponencial) para erros de timeout/rede.
 */
export async function invokeExternalRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
): Promise<T> {
  // supabase.rpc requires a generated function name; dynamic names go through unknown
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { data, error } = await rpc(rpcName, params);
    if (!error) return data as T;
    const msg = error?.message || 'Erro na RPC';
    if (attempt < MAX_RETRIES && isRetryableError(msg)) {
      const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
      logger.warn(
        `[external-rpc] Retry ${attempt + 1}/${MAX_RETRIES} for ${rpcName} after ${delay}ms: ${msg}`,
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(msg);
  }
  throw new Error('Max retries exceeded');
}
