/**
 * Hook for AI usage tracking data.
 * Users see their own usage; admins see all users.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AiUsageLog {
  id: string;
  user_id: string;
  function_name: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiUsageQuota {
  id: string;
  role: string;
  monthly_limit: number;
  is_unlimited: boolean;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  unlimited?: boolean;
}

// Fetch user's quota status
export function useAiQuotaStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ai-quota-status', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('check_ai_quota', { _user_id: user.id });
      if (error) throw error;
      return data as unknown as QuotaStatus;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

// Fetch usage logs (user sees own, admin sees all)
export function useAiUsageLogs(options?: {
  userId?: string;
  functionName?: string;
  period?: 'day' | 'week' | 'month' | 'all';
  limit?: number;
}) {
  const { user } = useAuth();
  const { userId, functionName, period = 'month', limit = 500 } = options || {};

  return useQuery({
    queryKey: ['ai-usage-logs', userId, functionName, period, limit],
    queryFn: async () => {
      let query = supabase
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) query = query.eq('user_id', userId);
      if (functionName) query = query.eq('function_name', functionName);

      if (period !== 'all') {
        const now = new Date();
        let start: Date;
        if (period === 'day') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (period === 'week') {
          start = new Date(now);
          start.setDate(start.getDate() - 7);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        query = query.gte('created_at', start.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AiUsageLog[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

// Fetch all quotas (admin only)
export function useAiQuotas() {
  return useQuery({
    queryKey: ['ai-usage-quotas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_usage_quotas').select('*').order('role');
      if (error) throw error;
      return (data ?? []) as AiUsageQuota[];
    },
    staleTime: 60_000,
  });
}

// Update a quota (admin only)
export function useUpdateQuota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; monthly_limit: number; is_unlimited: boolean }) => {
      const { error } = await supabase
        .from('ai_usage_quotas')
        .update({
          monthly_limit: params.monthly_limit,
          is_unlimited: params.is_unlimited,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-quotas'] });
    },
  });
}

// Aggregated stats for admin dashboard
export function useAiUsageStats(period: 'day' | 'week' | 'month' = 'month') {
  return useQuery({
    queryKey: ['ai-usage-stats', period],
    queryFn: async () => {
      const now = new Date();
      let start: Date;
      if (period === 'day') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (period === 'week') {
        start = new Date(now);
        start.setDate(start.getDate() - 7);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;

      const logs = (data ?? []) as AiUsageLog[];
      const totalRequests = logs.length;
      const successCount = logs.filter((l) => l.status === 'success').length;
      const totalTokens = logs.reduce((s, l) => s + l.total_tokens, 0);
      const totalCost = logs.reduce((s, l) => s + Number(l.estimated_cost_usd), 0);

      // Group by user
      const byUser = new Map<string, { count: number; cost: number; tokens: number }>();
      for (const log of logs) {
        const u = byUser.get(log.user_id) || { count: 0, cost: 0, tokens: 0 };
        u.count++;
        u.cost += Number(log.estimated_cost_usd);
        u.tokens += log.total_tokens;
        byUser.set(log.user_id, u);
      }

      // Group by function
      const byFunction = new Map<string, { count: number; cost: number; tokens: number }>();
      for (const log of logs) {
        const f = byFunction.get(log.function_name) || { count: 0, cost: 0, tokens: 0 };
        f.count++;
        f.cost += Number(log.estimated_cost_usd);
        f.tokens += log.total_tokens;
        byFunction.set(log.function_name, f);
      }

      // Group by model
      const byModel = new Map<string, { count: number; cost: number; tokens: number }>();
      for (const log of logs) {
        const m = log.model || 'unknown';
        const entry = byModel.get(m) || { count: 0, cost: 0, tokens: 0 };
        entry.count++;
        entry.cost += Number(log.estimated_cost_usd);
        entry.tokens += log.total_tokens;
        byModel.set(m, entry);
      }

      // Daily breakdown for chart
      const byDay = new Map<string, { count: number; cost: number; tokens: number }>();
      for (const log of logs) {
        const day = log.created_at.slice(0, 10);
        const d = byDay.get(day) || { count: 0, cost: 0, tokens: 0 };
        d.count++;
        d.cost += Number(log.estimated_cost_usd);
        d.tokens += log.total_tokens;
        byDay.set(day, d);
      }

      return {
        totalRequests,
        successCount,
        errorCount: totalRequests - successCount,
        totalTokens,
        totalCost,
        byUser: Array.from(byUser.entries())
          .map(([userId, stats]) => ({ userId, ...stats }))
          .sort((a, b) => b.cost - a.cost),
        byFunction: Array.from(byFunction.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.count - a.count),
        byModel: Array.from(byModel.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.count - a.count),
        byDay: Array.from(byDay.entries())
          .map(([date, stats]) => ({ date, ...stats }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
    staleTime: 30_000,
  });
}
