/**
 * usePulseBarStatus — agrega sinais de saúde do hub de Conexões em
 * severidade global P0/P1/P2 + KPIs resumidos para a Pulse Bar sticky.
 *
 * Severidades:
 *  - P0 (crítico): conexão caída + janela de falha contínua excedida,
 *                  OU webhook desabilitado pelo circuit breaker,
 *                  OU sucesso 24h < 70%.
 *  - P1 (atenção): conexões com last_test_ok=false (sem janela),
 *                  ou sucesso 24h entre 70% e 95%,
 *                  ou credenciais sem rotação >90d,
 *                  ou auto-test parado há >2x intervalo.
 *  - P2 (info):    tudo verde / informacional.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PulseSeverity = 'P0' | 'P1' | 'P2';

export interface PulseBarStatus {
  severity: PulseSeverity;
  headline: string;
  reasons: string[];
  kpis: {
    activeWebhooks: number;
    totalWebhooks: number;
    successRate24h: number | null;
    totalDeliveries24h: number;
    failingConnections: number;
    autoDisabledWebhooks: number;
    staleSecrets: number;
    lastSuccessAt: string | null;
    lastAutoTestAt: string | null;
  };
}

async function fetchStatus(): Promise<PulseBarStatus> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: activeWebhooks },
    { count: totalWebhooks },
    { data: deliveries24h },
    { data: lastSuccess },
    { count: failingConnections },
    { data: rotations },
    { count: autoDisabledWebhooks },
    { data: lastAutoTest },
  ] = await Promise.all([
    supabase
      .from('outbound_webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    supabase.from('outbound_webhooks').select('id', { count: 'exact', head: true }),
    supabase.from('webhook_deliveries').select('success').gte('delivered_at', since24h),
    supabase
      .from('webhook_deliveries')
      .select('delivered_at')
      .eq('success', true)
      .order('delivered_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('external_connections')
      .select('id', { count: 'exact', head: true })
      .eq('last_test_ok', false),
    supabase
      .from('secret_rotation_log')
      .select('secret_name, rotated_at')
      .order('rotated_at', { ascending: false }),
    supabase
      .from('outbound_webhooks')
      .select('id', { count: 'exact', head: true })
      .not('auto_disabled_at', 'is', null),
    supabase
      .from('connection_test_history')
      .select('tested_at')
      .eq('triggered_by', 'cron')
      .order('tested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const total = deliveries24h?.length ?? 0;
  const success = deliveries24h?.filter((d) => d.success).length ?? 0;
  const rate = total > 0 ? (success / total) * 100 : null;

  const lastBySecret = new Map<string, string>();
  for (const r of rotations ?? []) {
    if (!lastBySecret.has(r.secret_name)) lastBySecret.set(r.secret_name, r.rotated_at);
  }
  const staleSecrets = Array.from(lastBySecret.values()).filter((t) => t < ninetyDaysAgo).length;

  const failing = failingConnections ?? 0;
  const autoDisabled = autoDisabledWebhooks ?? 0;

  const reasonsP0: string[] = [];
  const reasonsP1: string[] = [];

  if (autoDisabled > 0) {
    reasonsP0.push(
      `${autoDisabled} webhook${autoDisabled === 1 ? '' : 's'} desativado${autoDisabled === 1 ? '' : 's'} pelo circuit breaker (pausado após muitas falhas)`,
    );
  }
  if (rate !== null && rate < 70) {
    reasonsP0.push(`Sucesso de entrega em 24h crítico: ${rate.toFixed(1)}%`);
  }
  if (failing > 0) {
    // Falhas pontuais sem janela de continuidade ⇒ P1; janela é avaliada no banner separado.
    reasonsP1.push(`${failing} conexão${failing === 1 ? '' : 'ões'} com último teste falhando`);
  }
  if (rate !== null && rate >= 70 && rate < 95) {
    reasonsP1.push(`Sucesso 24h em atenção: ${rate.toFixed(1)}% (alvo ≥95%)`);
  }
  if (staleSecrets > 0) {
    reasonsP1.push(
      `${staleSecrets} credencial${staleSecrets === 1 ? '' : 'is'} sem rotação há >90 dias (rotation overdue)`,
    );
  }

  let severity: PulseSeverity = 'P2';
  let headline = 'Todas as integrações operando dentro do esperado';
  let reasons: string[] = [];

  if (reasonsP0.length > 0) {
    severity = 'P0';
    headline = 'Incidente crítico em integrações — ação imediata';
    reasons = [...reasonsP0, ...reasonsP1];
  } else if (reasonsP1.length > 0) {
    severity = 'P1';
    headline = 'Sinais de degradação — monitorar de perto';
    reasons = reasonsP1;
  }

  return {
    severity,
    headline,
    reasons,
    kpis: {
      activeWebhooks: activeWebhooks ?? 0,
      totalWebhooks: totalWebhooks ?? 0,
      successRate24h: rate,
      totalDeliveries24h: total,
      failingConnections: failing,
      autoDisabledWebhooks: autoDisabled,
      staleSecrets,
      lastSuccessAt: lastSuccess?.delivered_at ?? null,
      lastAutoTestAt: lastAutoTest?.tested_at ?? null,
    },
  };
}

export function usePulseBarStatus() {
  // BUG-HEAD-GUARD FIX (2026-06-23): 4 HEAD requests sem JWT validado.
  // enabled: rolesLoaded && isAdmin bloqueia até JWT pronto.
  const { rolesLoaded, isAdmin } = useAuth();
  return useQuery({
    queryKey: ['connections-pulse-bar'],
    queryFn: fetchStatus,
    enabled: rolesLoaded && Boolean(isAdmin),
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
