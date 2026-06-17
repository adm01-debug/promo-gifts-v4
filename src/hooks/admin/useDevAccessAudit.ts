/**
 * useDevAccessAudit
 *
 * Para usuários com role `dev`, executa um SELECT mínimo (id LIMIT 1) em cada
 * tabela sensível esperada para detectar mismatch de RBAC — qualquer erro de
 * RLS / "permission denied" é classificado como bloqueio inesperado.
 *
 * Não consome dados reais; apenas dispara o gate de RLS. Roda uma vez ao
 * montar e pode ser re-executado sob demanda.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toErrorMessage } from '@/lib/to-error-message';

export interface DevAccessProbeResult {
  table: string;
  ok: boolean;
  error?: string;
}

/** Tabelas sensíveis que um dev DEVE conseguir ler. */
export const DEV_EXPECTED_TABLES = [
  'admin_audit_log',
  'ai_usage_logs',
  'ai_usage_quotas',
  'bot_detection_log',
  'external_connections_sync_log',
  'integration_credentials',
  'inbound_webhook_endpoints',
  'inbound_webhook_events',
  'ip_access_control',
] as const;

type ExpectedTable = (typeof DEV_EXPECTED_TABLES)[number];

interface UseDevAccessAuditState {
  loading: boolean;
  results: DevAccessProbeResult[];
  blocked: DevAccessProbeResult[];
  ranAt: Date | null;
  enabled: boolean;
}

export function useDevAccessAudit() {
  const { isDev, user } = useAuth();
  const enabled = !!user && isDev;

  const [state, setState] = useState<UseDevAccessAuditState>({
    loading: false,
    results: [],
    blocked: [],
    ranAt: null,
    enabled,
  });

  const run = useCallback(async () => {
    if (!enabled) {
      setState((s) => ({ ...s, enabled: false, results: [], blocked: [] }));
      return;
    }
    setState((s) => ({ ...s, loading: true, enabled: true }));

    const probes = await Promise.all(
      DEV_EXPECTED_TABLES.map<Promise<DevAccessProbeResult>>(async (table) => {
        try {
          const { error } = await supabase
            // dynamic table name validated against fixed allowlist
            .from(table as ExpectedTable)
            .select('id', { head: true, count: 'exact' })
            .limit(1);

          if (error) {
            // Códigos típicos de RLS / permissão
            const msg = error.message ?? 'unknown error';
            const isDenial =
              error.code === '42501' || // insufficient_privilege
              error.code === 'PGRST301' || // RLS denial
              /permission denied|row-level security|rls/i.test(msg);
            return { table, ok: !isDenial, error: msg };
          }
          return { table, ok: true };
        } catch (e) {
          return {
            table,
            ok: false,
            error: toErrorMessage(e),
          };
        }
      }),
    );

    setState({
      loading: false,
      results: probes,
      blocked: probes.filter((p) => !p.ok),
      ranAt: new Date(),
      enabled: true,
    });
  }, [enabled]);

  useEffect(() => {
    void run();
  }, [run]);

  return { ...state, run };
}
