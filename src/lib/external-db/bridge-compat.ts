/**
 * Bridge Compatibility Shim (2026-05-30)
 *
 * Drop-in replacement for `supabase.functions.invoke('external-db-bridge', { body })`.
 * Routes SELECT operations through REST native (invokeExternalDb) and handles
 * write operations with graceful 410 error handling.
 *
 * MIGRATION: replace
 *   const { data, error } = await supabase.functions.invoke('external-db-bridge', { body });
 * with:
 *   const { data, error } = await invokeExternalDbBridge(body);
 *
 * The response format matches the bridge contract:
 *   data.success: boolean
 *   data.data.records: T[]
 *   data.data.count: number | null
 *   data.error: string (when !success)
 */
import { supabase } from '@/integrations/supabase/client';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';
import type { InvokeOptions, Operation } from '@/lib/external-db/bridge';

interface BridgeBody {
  table?: string;
  operation?: string;
  filters?: Record<string, unknown>;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  data?: unknown;
  id?: string;
  countMode?: string;
  [key: string]: unknown;
}

interface BridgeCompatResponse {
  data: {
    success: boolean;
    ok?: boolean;
    config?: { has_url: boolean; has_key: boolean; is_external: boolean; url?: string };
    data?: { records: unknown[]; count: number | null };
    error?: string;
  } | null;
  error: { message: string } | null;
}

/**
 * Drop-in replacement for supabase.functions.invoke('external-db-bridge', { body }).
 *
 * For SELECT on REST-native-eligible tables: routes to PostgREST directly.
 * For everything else: tries the bridge Edge Function with 410/CORS guard.
 */
export async function invokeExternalDbBridge(body: BridgeBody): Promise<BridgeCompatResponse> {
  const table = body.table ?? '';
  const operation = (body.operation ?? 'select') as string;

  if (operation === 'ping') {
    return {
      data: {
        success: true,
        ok: true,
        config: { has_url: true, has_key: true, is_external: true, url: 'Configurado' },
      },
      error: null,
    };
  }

  // SELECT operations: route through invokeExternalDb (REST native path)
  if (operation === 'select') {
    try {
      const opts: InvokeOptions = {
        table,
        operation: 'select',
        filters: body.filters,
        select: body.select,
        orderBy: body.orderBy,
        limit: body.limit,
        offset: body.offset,
        countMode: (body.countMode as InvokeOptions['countMode']) ?? 'none',
      };
      const result = await invokeExternalDb<Record<string, unknown>>(opts);
      return {
        data: {
          success: true,
          data: { records: result.records, count: result.count },
        },
        error: null,
      };
    } catch (e) {
      const msg = (e as Error).message;
      logger.warn(`[bridge-compat] SELECT failed for ${table}: ${msg}`);
      return {
        data: { success: false, error: msg },
        error: null,
      };
    }
  }

  // RPC operations: route through invokeExternalDb
  if (operation === 'rpc') {
    try {
      const opts: InvokeOptions = {
        table,
        operation: operation as Operation,
        data: body.data as Record<string, unknown>,
        filters: body.filters,
      };
      const result = await invokeExternalDb<Record<string, unknown>>(opts);
      return {
        data: {
          success: true,
          data: { records: result.records, count: result.count },
        },
        error: null,
      };
    } catch (e) {
      const msg = (e as Error).message;
      logger.warn(`[bridge-compat] RPC failed for ${table}: ${msg}`);
      return { data: { success: false, error: msg }, error: null };
    }
  }

  // Write operations (insert, update, delete, upsert, batch_insert, ping):
  // Try the bridge Edge Function with graceful error handling.
  // If bridge returns 410 or CORS error, return a clear error.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const { data, error } = await supabase.functions.invoke('external-db-bridge', {
      body,
      headers,
    });

    if (error) {
      const msg = error.message ?? 'Unknown bridge error';
      // 410 Gone = bridge deprecated
      if (msg.includes('410') || msg.includes('Gone') || msg.includes('descontinuada')) {
        logger.warn(
          `[bridge-compat] Bridge deprecated (410) for ${table}/${operation}. ` +
            'Admin CRUD needs migration to direct Supabase client.',
        );
        return {
          data: {
            success: false,
            error: `Operacao ${operation} em ${table} temporariamente indisponivel. A bridge foi descontinuada.`,
          },
          error: null,
        };
      }
      return { data: null, error: { message: msg } };
    }

    return { data, error: null };
  } catch (e) {
    const msg = (e as Error).message;
    const isCorsOrNetwork =
      msg.includes('CORS') ||
      msg.includes('ERR_FAILED') ||
      msg.includes('Failed to fetch') ||
      msg.includes('network');

    if (isCorsOrNetwork) {
      logger.debug(
        `[bridge-compat] CORS/network error for ${table}/${operation} - returning error`,
      );
      return {
        data: {
          success: false,
          error: `Bridge indisponivel para ${table}/${operation}.`,
        },
        error: null,
      };
    }

    return { data: null, error: { message: msg } };
  }
}
