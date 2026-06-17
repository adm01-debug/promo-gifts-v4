import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TelemetryRow {
  id: string;
  operation: string;
  table_name: string | null;
  rpc_name: string | null;
  duration_ms: number;
  record_count: number | null;
  query_limit: number | null;
  query_offset: number | null;
  count_mode: string | null;
  severity: string;
  error_message: string | null;
  user_id: string | null;
  created_at: string;
}

export type SeverityFilter = 'all' | 'slow' | 'very_slow' | 'error';
export type TimeFilter = '1h' | '6h' | '24h' | '7d' | 'custom';

export interface TableStat {
  name: string;
  count: number;
  totalMs: number;
  maxMs: number;
}

const TIME_FILTER_MS: Record<string, number> = {
  '1h': 3600000,
  '6h': 21600000,
  '24h': 86400000,
  '7d': 604800000,
} as const;

export function useTelemetryData() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  const getTimeThreshold = (): { from: string; to: string } => {
    const now = new Date();
    if (timeFilter === 'custom' && customDateFrom) {
      const from = new Date(customDateFrom);
      from.setHours(0, 0, 0, 0);
      const to = customDateTo ? new Date(customDateTo) : new Date();
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const ms = TIME_FILTER_MS[timeFilter] || 86400000;
    return { from: new Date(now.getTime() - ms).toISOString(), to: now.toISOString() };
  };

  const {
    data: rows = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<TelemetryRow[]>({
    queryKey: [
      'query-telemetry',
      severityFilter,
      timeFilter,
      customDateFrom?.toISOString(),
      customDateTo?.toISOString(),
    ],
    queryFn: async () => {
      const { from, to } = getTimeThreshold();
      let query = supabase
        .from('query_telemetry')
        .select('*')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(500);
      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as TelemetryRow[]) ?? [];
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const handleCleanup = async () => {
    const threshold = new Date(Date.now() - 604800000).toISOString();
    const { error } = await supabase.from('query_telemetry').delete().lt('created_at', threshold);
    if (error) toast.error('Erro ao limpar dados antigos');
    else {
      toast.success('Dados com mais de 7 dias removidos');
      refetch();
    }
  };

  // Stats
  const verySlow = rows.filter((r) => r.severity === 'very_slow').length;
  const slow = rows.filter((r) => r.severity === 'slow').length;
  const errors = rows.filter((r) => r.severity === 'error').length;
  const avgDuration =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.duration_ms, 0) / rows.length) : 0;

  // Top offenders
  const tableStats = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  for (const r of rows) {
    const key = r.rpc_name || r.table_name || 'unknown';
    const prev = tableStats.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
    tableStats.set(key, {
      count: prev.count + 1,
      totalMs: prev.totalMs + r.duration_ms,
      maxMs: Math.max(prev.maxMs, r.duration_ms),
    });
  }
  const topOffenders: TableStat[] = [...tableStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, stats]) => ({ name, ...stats }));

  return {
    rows,
    isLoading,
    isRefetching,
    refetch,
    handleCleanup,
    severityFilter,
    setSeverityFilter,
    timeFilter,
    setTimeFilter,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    stats: { verySlow, slow, errors, avgDuration },
    topOffenders,
  };
}

export const formatDuration = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
