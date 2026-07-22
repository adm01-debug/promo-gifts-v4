import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { logger } from '@/lib/logger';
import { safeAuthCall, type SafeAuthResult } from '@/lib/auth/safeAuthCall';
import type { PostgrestError } from '@supabase/supabase-js';

// BUG-FIX v2.1: tipo explícito para cast seguro de supabase.rpc
type RPCCallerFn<T = unknown> = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: T | null; error: PostgrestError | null }>;

export const authService = {
  async signIn(email: string, password: string) {
    const supabase = await getSupabaseClient();
    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  async signOut() {
    const supabase = await getSupabaseClient();
    try {
      await Promise.race([
        supabase.rpc('log_user_logout'),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout RPC')), 2000);
        }),
      ]);
    } catch (err) {
      logger.warn('log_user_logout failed', { err: String(err) });
    }
    return supabase.auth.signOut({ scope: 'global' });
  },

  async fetchAAL() {
    const supabase = await getSupabaseClient();
    const [{ data: aalData }, { data: factorsData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    return {
      currentAAL: (aalData?.currentLevel ?? null) as 'aal1' | 'aal2' | null,
      nextAAL: (aalData?.nextLevel ?? null) as 'aal1' | 'aal2' | null,
      hasMFA: !!factorsData?.totp?.some((f) => f.status === 'verified'),
    };
  },

  /**
   * @deprecated Prefira getProfileAndRoles() que usa 1 round-trip.
   * Mantido para callers legados fora do useProfileRoles.
   */
  async queryRoles(userId: string) {
    const supabase = await getSupabaseClient();
    return supabase.from('user_roles').select('role').eq('user_id', userId);
  },

  /**
   * RPC combinada: retorna profile + roles em um único round-trip.
   * Seguro: `as unknown as RPCCallerFn` evita erro TS em strict mode.
   */
  async getProfileAndRoles(
    userId: string,
  ): Promise<{
    data: { profile: Record<string, unknown> | null; roles: string[] | null } | null;
    error: PostgrestError | null;
  }> {
    const supabase = await getSupabaseClient();
    const caller = supabase.rpc as unknown as RPCCallerFn<
      { profile: Record<string, unknown> | null; roles: string[] | null }
    >;
    return caller('get_profile_and_roles', { _user_id: userId });
  },

  async fetchProfile(userId: string) {
    const supabase = await getSupabaseClient();
    return supabase.from('profiles').select('*').eq('user_id', userId).single();
  },

  async updateLastLogin(userId: string) {
    const supabase = await getSupabaseClient();
    return supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', userId);
  },
};
