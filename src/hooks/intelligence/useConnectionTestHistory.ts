import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ConnectionType } from '@/hooks/intelligence/useConnectionTester';

export interface TestHistoryItem {
  id: string;
  tested_at: string;
  ok: boolean;
  latency_ms: number | null;
  status: number | null;
  message: string | null;
  /** Tipo semântico da falha (gravado pelo backend; null em sucessos ou registros antigos). */
  error_kind?: string | null;
  triggered_by?: 'cron' | 'manual' | 'webhook';
  attempts?: number;
}

interface Options {
  type: ConnectionType;
  envKey?: 'crm' | 'promobrind';
  connectionId?: string;
  /** Bumped externally after a "Testar conexão" succeeds — triggers refetch. */
  refreshKey?: number | string;
  /** When true (panel open), polls every 60s. */
  enabled?: boolean;
  limit?: number;
}

export function useConnectionTestHistory({
  type,
  envKey,
  connectionId,
  refreshKey,
  enabled = false,
  limit = 10,
}: Options) {
  const [items, setItems] = useState<TestHistoryItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('connection-tester', {
        body: {
          action: 'test_history',
          type,
          env_key: envKey,
          connection_id: connectionId,
          limit,
        },
      });
      if (fnErr) throw fnErr;
      if (cancelRef.current) return;
      setItems((data?.items ?? []) as TestHistoryItem[]);
      setTotal(typeof data?.total === 'number' ? data.total : (data?.items?.length ?? 0));
    } catch (e) {
      if (cancelRef.current) return;
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [type, envKey, connectionId, limit]);

  // Initial + refreshKey-triggered fetch (always, regardless of enabled).
  useEffect(() => {
    cancelRef.current = false;
    fetchOnce();
    return () => {
      cancelRef.current = true;
    };
  }, [fetchOnce, refreshKey]);

  // Polling only when enabled (panel open).
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      fetchOnce();
    }, 60_000);
    return () => clearInterval(id);
  }, [enabled, fetchOnce]);

  return { items, total, loading, error, refresh: fetchOnce };
}
