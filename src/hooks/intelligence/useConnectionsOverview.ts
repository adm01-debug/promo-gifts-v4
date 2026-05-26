import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OverviewRow {
  key: string;
  id: string | null;
  type: 'supabase' | 'bitrix24' | 'n8n' | 'mcp' | 'webhook_outbound' | string;
  name: string;
  env_key: 'promobrind' | 'crm' | null;
  status: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  last_latency_ms: number | null;
  auto_test_enabled: boolean;
}

export function useConnectionsOverview(pollMs = 30000) {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await supabase
      .from('external_connections')
      .select(
        'id, type, name, env_key, status, last_test_at, last_test_ok, last_test_message, last_latency_ms, auto_test_enabled',
      )
      .order('type', { ascending: true })
      .order('name', { ascending: true });
    if (!error && data) {
      const mapped: OverviewRow[] = data.map((r) => ({
        key: r.id,
        id: r.id,
        type: r.type,
        name: r.name,
        env_key: (r.env_key as 'promobrind' | 'crm' | null) ?? null,
        status: r.status,
        last_test_at: r.last_test_at,
        last_test_ok: r.last_test_ok,
        last_test_message: r.last_test_message,
        last_latency_ms: r.last_latency_ms,
        auto_test_enabled: (r as { auto_test_enabled?: boolean }).auto_test_enabled ?? true,
      }));
      setRows(mapped);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(true);
    if (pollMs <= 0) return;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const patchRow = useCallback((key: string, patch: Partial<OverviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  return { rows, loading, refreshing, refresh: () => load(false), patchRow };
}
