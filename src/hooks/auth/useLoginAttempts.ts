/**
 * useLoginAttempts — Hook for admin dashboard to view login attempt history
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ip_address: string;
  user_agent: string | null;
  failure_reason: string | null;
  user_id: string | null;
  created_at: string;
}

interface UseLoginAttemptsOptions {
  page?: number;
  pageSize?: number;
  emailFilter?: string;
  successFilter?: boolean | null;
}

export function useLoginAttempts(options: UseLoginAttemptsOptions = {}) {
  const { page = 1, pageSize = 50, emailFilter, successFilter } = options;

  return useQuery({
    queryKey: ['login-attempts', page, pageSize, emailFilter, successFilter],
    queryFn: async () => {
      let query = supabase
        .from('login_attempts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (emailFilter) {
        query = query.ilike('email', `%${emailFilter}%`);
      }

      if (successFilter !== null && successFilter !== undefined) {
        query = query.eq('success', successFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        attempts: (data ?? []) as LoginAttempt[],
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
    /**
     * BUG-06 FIX: staleTime ausente causava refetch agressivo.
     *
     * PROBLEMA ORIGINAL: sem staleTime, qualquer foco na janela ou remount
     * disparava refetch completo da tabela login_attempts. Para dados de
     * auditoria histórica, 30s de cache é razoável e reduz carga no banco.
     */
    staleTime: 30_000,
  });
}

export function useLoginAttemptStats() {
  return useQuery({
    queryKey: ['login-attempt-stats'],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ count: total24h }, { count: failed24h }, { count: total7d }] = await Promise.all([
        supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last24h),
        supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last24h)
          .eq('success', false),
        supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last7d),
      ]);

      return {
        total24h: total24h || 0,
        failed24h: failed24h || 0,
        total7d: total7d || 0,
        failRate24h: total24h ? Math.round(((failed24h || 0) / total24h) * 100) : 0,
      };
    },
    refetchInterval: 60_000,
    // FIX: staleTime alinhado com refetchInterval para evitar refetch duplo no focus
    staleTime: 30_000,
  });
}
