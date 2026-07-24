import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OverviewRow {
  key: string;
  id: string | null;
  type: string | 'bitrix24' | 'mcp' | 'n8n' | 'supabase' | 'webhook_outbound';
  name: string;
  env_key: 'crm' | 'promobrind' | null;
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

  /**
   * BUG-26 FIX: mountedRef para guard de load (isMounted pattern).
   *
   * PROBLEMA: `load` (useCallback[]) chamava setRows/setLoading/setRefreshing
   * após uma query Supabase sem verificar se o componente ainda estava montado.
   * Navegação rápida entre páginas durante o fetch de 30s causava warnings de
   * "setState on unmounted component".
   */
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await supabase
      .from('external_connections')
      .select(
        'id, type, name, env_key, status, last_test_at, last_test_ok, last_test_message, last_latency_ms, auto_test_enabled',
      )
      .order('type', { ascending: true })
      .order('name', { ascending: true });
    if (!mountedRef.current) return; // BUG-26 FIX: guard pós-await
    if (!error && data) {
      const mapped: OverviewRow[] = data.map((r) => ({
        key: r.id,
        id: r.id,
        type: r.type,
        name: r.name,
        env_key: (r.env_key as 'crm' | 'promobrind' | null) ?? null,
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
  }, []); // mountedRef é estável

  useEffect(() => {
    mountedRef.current = true;
    load(true);
    if (pollMs <= 0)
      return () => {
        mountedRef.current = false;
      };
    const id = setInterval(() => load(true), pollMs);
    return () => {
      mountedRef.current = false; // BUG-26 FIX: sinaliza unmount antes de clearInterval
      clearInterval(id);
    };
  }, [load, pollMs]);

  const patchRow = useCallback((key: string, patch: Partial<OverviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  return { rows, loading, refreshing, refresh: () => load(false), patchRow };
}
