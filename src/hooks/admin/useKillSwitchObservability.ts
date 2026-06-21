/**
 * Hook do dashboard de observabilidade do kill-switch.
 *
 * Consulta:
 *   - v_kill_switch_hits_summary (agregados 1h/24h/7d por origem)
 *   - system_kill_switches (estado atual dos switches)
 *
 * Auto-refresh: 30s (não-crítico, polling leve via setInterval).
 * Fail-silent: erros não derrubam o dashboard.
 *
 * Acesso: apenas admin (RLS no banco rejeita não-admin).
 */
import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toErrorMessage } from '@/lib/to-error-message';

export interface SwitchState {
  switch_name: string;
  enabled: boolean;
  legacy_message: string | null;
  updated_at: string | null;
  rollout_percentage: number | null;
}

export interface SwitchHitSummary {
  switch_name: string;
  source: 'back' | 'front';
  operation: string | null;
  target: string | null;
  hits: number;
  hits_1h: number;
  hits_24h: number;
  hits_7d: number;
  last_hit: string;
}

export interface KillSwitchObservabilityData {
  switches: SwitchState[];
  summary: SwitchHitSummary[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  refresh: () => void;
}

const REFRESH_INTERVAL_MS = 30_000;

export function useKillSwitchObservability(): KillSwitchObservabilityData {
  const [switches, setSwitches] = useState<SwitchState[]>([]);
  const [summary, setSummary] = useState<SwitchHitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      // Cast controlado — tabelas novas ainda não estão no gen-types.
      const [switchesRes, summaryRes] = await Promise.all([
        untypedFrom<SwitchState>('system_kill_switches').select(
          'switch_name, enabled, legacy_message, updated_at, rollout_percentage',
        ),
        untypedFrom<SwitchHitSummary>('v_kill_switch_hits_summary')
          .select('*')
          .order('hits_24h', { ascending: false })
          .limit(100),
      ]);

      if (switchesRes.error) throw new Error(`switches: ${switchesRes.error.message}`);
      if (summaryRes.error) throw new Error(`summary: ${summaryRes.error.message}`);

      setSwitches((switchesRes.data ?? []) as SwitchState[]);
      setSummary((summaryRes.data ?? []) as SwitchHitSummary[]);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      const msg = toErrorMessage(e);
      logger.warn(`[useKillSwitchObservability] load failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { switches, summary, loading, error, lastRefresh, refresh: load };
}
