/**
 * Hook do dashboard de smoke tests.
 *
 * Consulta:
 *   - v_smoke_tests_latest_run (última execução, ordenado FAIL → WARN → PASS)
 *   - v_smoke_tests_trend (12 últimas execuções com agregados)
 *
 * Execução manual: chama RPC public.fn_run_and_persist_smoke_tests().
 *
 * Acesso: apenas admin.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface SmokeTestRow {
  ran_at: string;
  test_name: string;
  test_category: string | null;
  result: string; // "✅ PASS" | "❌ FAIL" | "⚠️ WARN"
  details: string | null;
  duration_ms: number | null;
}

export interface SmokeTestTrend {
  ran_at: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  avg_duration_ms: number | null;
}

export interface SmokeTestsData {
  latest: SmokeTestRow[];
  trend: SmokeTestTrend[];
  loading: boolean;
  error: string | null;
  running: boolean;
  lastRun: Date | null;
  refresh: () => void;
  runNow: () => Promise<void>;
}

export function useSmokeTests(): SmokeTestsData {
  const [latest, setLatest] = useState<SmokeTestRow[]>([]);
  const [trend, setTrend] = useState<SmokeTestTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      // deno-lint-ignore no-explicit-any
      const client = supabase as any;
      const [latestRes, trendRes] = await Promise.all([
        client.from('v_smoke_tests_latest_run').select('*'),
        client.from('v_smoke_tests_trend').select('*'),
      ]);

      if (latestRes.error) throw new Error(`latest: ${latestRes.error.message}`);
      if (trendRes.error) throw new Error(`trend: ${trendRes.error.message}`);

      setLatest((latestRes.data ?? []) as SmokeTestRow[]);
      setTrend((trendRes.data ?? []) as SmokeTestTrend[]);
      setError(null);
      if (latestRes.data?.[0]?.ran_at) {
        setLastRun(new Date(latestRes.data[0].ran_at));
      }
    } catch (e) {
      const msg = (e as Error).message;
      logger.warn(`[useSmokeTests] load failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const runNow = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      // deno-lint-ignore no-explicit-any
      const client = supabase as any;
      const { error: rpcError } = await client.rpc('fn_run_and_persist_smoke_tests');
      if (rpcError) throw new Error(rpcError.message);
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      logger.warn(`[useSmokeTests] runNow failed: ${msg}`);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [load, running]);

  useEffect(() => {
    void load();
  }, [load]);

  return { latest, trend, loading, error, running, lastRun, refresh: load, runNow };
}
