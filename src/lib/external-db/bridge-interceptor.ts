/**
 * Bridge Interceptor (2026-05-30)
 *
 * Patches supabase.functions.invoke at app startup to intercept ALL calls
 * to 'external-db-bridge' and route them through the compatibility shim.
 *
 * This is a SIDE-EFFECT module: importing it patches the global supabase
 * instance. Must be imported early in main.tsx, BEFORE any React component
 * renders (to ensure all hooks use the patched version).
 *
 * Effect:
 *   - SELECT operations -> invokeExternalDb() -> PostgREST (REST native)
 *   - WRITE operations -> bridge Edge Function with 410/CORS guard
 *   - All other Edge Functions (manage-users, secrets-manager, etc.) -> untouched
 *
 * This eliminates 56+ remaining direct bridge calls without editing any
 * caller files. Remove this module when the bridge is fully decommissioned
 * and all callers have been individually migrated.
 */
import { supabase } from '@/integrations/supabase/client';
import { invokeExternalDbBridge } from '@/lib/external-db/bridge-compat';

// Preserve original invoke for non-bridge function calls
const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

// Patch: intercept external-db-bridge, pass through everything else
(supabase.functions as { invoke: typeof supabase.functions.invoke }).invoke =
  async function patchedInvoke(
    functionName: string,
    options?: { body?: Record<string, unknown>; headers?: Record<string, string> },
  ) {
    if (functionName === 'external-db-bridge') {
      return invokeExternalDbBridge(options?.body ?? {});
    }
    return originalInvoke(functionName, options);
  } as typeof supabase.functions.invoke;
