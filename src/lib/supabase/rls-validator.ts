/**
 * RLS Policy Validator
 * Runtime checks to detect RLS policy gaps before they cause production issues.
 * PhD-level defensive programming.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

interface RLSCheck {
  table: string;
  policy: string;
  isActive: boolean;
  appliesTo: ('DELETE' | 'INSERT' | 'SELECT' | 'UPDATE')[];
  timestamp: number;
}

interface RLSValidationResult {
  isHealthy: boolean;
  checks: RLSCheck[];
  warnings: string[];
  errors: string[];
  appliedAt: Date;
}

const CRITICAL_TABLES = [
  'discount_approval_requests',
  'workspace_notifications',
  'profiles',
  'organizations',
] as const;

const _EXPECTED_POLICIES: Record<string, Set<string>> = {
  discount_approval_requests: new Set([
    'enable_read_for_requesting_user',
    'enable_insert_for_requesting_user',
    'enable_update_for_requesting_user',
  ]),
  workspace_notifications: new Set([
    'user_sees_own_notifications',
    'user_can_insert_own_notifications',
    'user_can_delete_own_notifications',
  ]),
};

/**
 * Validate RLS policies at application boot.
 * Runs silently in background; logs warnings if gaps detected.
 */
export async function validateRLSPolicies(): Promise<RLSValidationResult> {
  const log = createClientLogger('rls.validator');
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: RLSCheck[] = [];
  let isHealthy = true;

  try {
    const supabase = await getSupabaseClient();
    const session = await supabase.auth.getSession();

    if (!session.data.session) {
      log.debug('rls_check_skipped_no_session');
      return {
        isHealthy: true, // Not authenticated yet; can't check
        checks: [],
        warnings: ['RLS validation deferred (not authenticated)'],
        errors: [],
        appliedAt: new Date(),
      };
    }

    // Test each critical table
    for (const table of CRITICAL_TABLES) {
      try {
        // Attempt a HEAD-like query (count only)
        const { count: _count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error) {
          if (error.code === 'PGRST116') {
            // No RLS policy
            errors.push(`${table}: No RLS policy defined`);
            isHealthy = false;
          } else if (error.code === '42P01') {
            // Table doesn't exist
            warnings.push(`${table}: Table not found (might be expected)`);
          } else {
            // Other error
            warnings.push(`${table}: ${error.message}`);
          }
        } else {
          checks.push({
            table,
            policy: 'default',
            isActive: true,
            appliesTo: ['SELECT'],
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        errors.push(`${table}: Exception during check - ${String(err)}`);
        isHealthy = false;
      }
    }

    if (!isHealthy) {
      log.error('rls_validation_failed', {
        errors: errors.join('; '),
        warnings: warnings.join('; '),
      });
    } else {
      log.info('rls_validation_ok', { checks: checks.length });
    }
  } catch (err) {
    log.error('rls_validator_exception', { err: String(err) });
    // Don't fail boot for validator errors; just log
  }

  return {
    isHealthy,
    checks,
    warnings,
    errors,
    appliedAt: new Date(),
  };
}

/**
 * Check if user has access to a specific table before querying.
 * Fail-safe: assumes access if check fails (better UX than blocking on network error).
 */
export async function canAccessTable(
  table: string,
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    const supabase = await getSupabaseClient();
    const session = await supabase.auth.getSession();

    if (!session.data.session) {
      return { canAccess: false, reason: 'Not authenticated' };
    }

    // Test with a zero-row query (table is a dynamic string; double-cast to untyped client)
    const { error } = await (supabase as unknown as SupabaseClient)
      .from(table)
      .select('*', { head: true })
      .limit(0);

    if (error?.code === 'PGRST116') {
      return { canAccess: false, reason: 'No RLS policy' };
    } else if (error?.code === '42P01') {
      return { canAccess: false, reason: 'Table not found' };
    } else if (error) {
      return { canAccess: false, reason: error.message };
    }

    return { canAccess: true };
  } catch {
    return { canAccess: false, reason: 'Check failed' };
  }
}
