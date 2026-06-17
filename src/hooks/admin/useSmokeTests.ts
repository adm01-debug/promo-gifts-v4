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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toErrorMessage } from '@/lib/to-error-message';

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

export interface SmokeModuleFailureRate {
  module: string;
  total: number;
  failed: number;
  failure_rate: number;
}

export interface SmokeSummaryMetrics {
  total: number;
  failed: number;
  warned: number;
  flake_rate: number;
  avg_duration_ms: number | null;
  useful_assert_density: number;
  module_failure_rates: SmokeModuleFailureRate[];
}

export interface SmokeTrendPoint {
  ran_at: string;
  failure_rate: number;
  avg_duration_ms: number | null;
}

export interface SmokeTestsData {
  latest: SmokeTestRow[];
  trend: SmokeTestTrend[];
  loading: boolean;
  error: string | null;
  running: boolean;
  lastRun: Date | null;
  summary: SmokeSummaryMetrics;
  historical: SmokeTrendPoint[];
  refresh: () => void;
  runNow: () => Promise<void>;
}

type SmokeTestRpcClient = {
  rpc(fn: 'fn_run_and_persist_smoke_tests'): Promise<{ error: { message?: string } | null }>;
};

export function useSmokeTests(): SmokeTestsData {
  const [latest, setLatest] = useState<SmokeTestRow[]>([]);
  const [trend, setTrend] = useState<SmokeTestTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [latestRes, trendRes] = await Promise.all([
        untypedFrom<SmokeTestRow>('v_smoke_tests_latest_run').select('*'),
        untypedFrom<SmokeTestTrend>('v_smoke_tests_trend').select('*'),
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
      const msg = toErrorMessage(e);
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
      const client = supabase as unknown as SmokeTestRpcClient;
      const { error: rpcError } = await client.rpc('fn_run_and_persist_smoke_tests');
      if (rpcError) throw new Error(rpcError.message);
      await load();
    } catch (e) {
      const msg = toErrorMessage(e);
      logger.warn(`[useSmokeTests] runNow failed: ${msg}`);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [load, running]);

  useEffect(() => {
    void load();
  }, [load]);

  const { summary, historical } = useMemo(() => {
    const total = latest.length;
    const failed = latest.filter((row) => row.result.includes('FAIL')).length;
    const warned = latest.filter((row) => row.result.includes('WARN')).length;
    const flakes = latest.filter((row) =>
      /flake|flaky|intermitente|timeout|retry/i.test(row.details ?? ''),
    ).length;

    const durationValues = latest
      .map((row) => row.duration_ms)
      .filter((value): value is number => typeof value === 'number');
    const avgDuration =
      durationValues.length > 0
        ? durationValues.reduce((acc, value) => acc + value, 0) / durationValues.length
        : null;

    const usefulAssertSignals = latest.reduce((acc, row) => {
      const details = row.details ?? '';
      const matches = details.match(/assert|expect\(|deve|valida|status\s*2\d\d/gi);
      return acc + (matches?.length ?? 0);
    }, 0);

    const moduleMap = latest.reduce<Record<string, { total: number; failed: number }>>(
      (acc, row) => {
        const module = row.test_category ?? 'sem-categoria';
        if (!acc[module]) acc[module] = { total: 0, failed: 0 };
        acc[module].total += 1;
        if (row.result.includes('FAIL')) acc[module].failed += 1;
        return acc;
      },
      {},
    );

    const module_failure_rates = Object.entries(moduleMap)
      .map(([module, values]) => ({
        module,
        total: values.total,
        failed: values.failed,
        failure_rate: values.total > 0 ? (values.failed / values.total) * 100 : 0,
      }))
      .sort((a, b) => b.failure_rate - a.failure_rate || b.total - a.total);

    const computedSummary: SmokeSummaryMetrics = {
      total,
      failed,
      warned,
      flake_rate: total > 0 ? (flakes / total) * 100 : 0,
      avg_duration_ms: avgDuration,
      useful_assert_density: total > 0 ? usefulAssertSignals / total : 0,
      module_failure_rates,
    };

    const computedHistorical: SmokeTrendPoint[] = trend
      .slice(0, 24)
      .reverse()
      .map((item) => ({
        ran_at: item.ran_at,
        avg_duration_ms: item.avg_duration_ms,
        failure_rate: item.total > 0 ? (item.failed / item.total) * 100 : 0,
      }));

    return { summary: computedSummary, historical: computedHistorical };
  }, [latest, trend]);

  return {
    latest,
    trend,
    loading,
    error,
    running,
    lastRun,
    summary,
    historical,
    refresh: load,
    runNow,
  };
}
