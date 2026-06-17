/**
 * IntegrationsHealthCard — Onda 9
 * Card read-only no topo de /admin/conexoes com auto-refresh 60s.
 * Mostra saúde agregada de webhooks, conexões e MCP keys.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  Webhook,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Clock,
  RefreshCw,
  ShieldCheck,
  Loader2,
  Bot,
  Database,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toErrorMessage } from '@/lib/to-error-message';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCredentialsSourceFilter, resolveSource } from './CredentialsSourceFilterContext';
import type { SecretStatus } from '@/hooks/admin';

interface HealthData {
  activeWebhooks: number;
  totalWebhooks: number;
  successRate24h: number | null;
  totalDeliveries24h: number;
  lastSuccessAt: string | null;
  failingConnections: number;
  mcpKeysUsed24h: number;
  staleSecrets: number; // secrets sem rotação há >90 dias (ou nunca rotacionados, com webhooks ativos)
  autoDisabledWebhooks: number;
  lastAutoTestAt: string | null;
  autoTestOkLastHour: number;
  autoTestFailLastHour: number;
}

async function fetchHealth(): Promise<HealthData> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceLastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: activeWebhooks },
    { count: totalWebhooks },
    { data: deliveries24h },
    { data: lastSuccess },
    { count: failingConnections },
    { count: mcpKeysUsed24h },
    { data: rotations },
    { count: autoDisabledWebhooks },
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
      .from('mcp_api_keys')
      .select('id', { count: 'exact', head: true })
      .gte('last_used_at', since24h)
      .is('revoked_at', null),
    supabase
      .from('secret_rotation_log')
      .select('secret_name, rotated_at')
      .order('rotated_at', { ascending: false }),
    supabase
      .from('outbound_webhooks')
      .select('id', { count: 'exact', head: true })
      .not('auto_disabled_at', 'is', null),
  ]);

  // Auto-test stats (cron-triggered runs in the last hour + most recent timestamp)
  const [{ data: autoTestRecent }, { data: lastAutoTest }] = await Promise.all([
    supabase
      .from('connection_test_history')
      .select('success')
      .eq('triggered_by', 'cron')
      .gte('tested_at', sinceLastHour),
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

  // Últimas rotações por nome de secret
  const lastBySecret = new Map<string, string>();
  for (const r of rotations ?? []) {
    if (!lastBySecret.has(r.secret_name)) lastBySecret.set(r.secret_name, r.rotated_at);
  }
  const staleSecrets = Array.from(lastBySecret.values()).filter((t) => t < ninetyDaysAgo).length;

  return {
    activeWebhooks: activeWebhooks ?? 0,
    totalWebhooks: totalWebhooks ?? 0,
    successRate24h: rate,
    totalDeliveries24h: total,
    lastSuccessAt: lastSuccess?.delivered_at ?? null,
    failingConnections: failingConnections ?? 0,
    mcpKeysUsed24h: mcpKeysUsed24h ?? 0,
    staleSecrets,
    autoDisabledWebhooks: autoDisabledWebhooks ?? 0,
    lastAutoTestAt: lastAutoTest?.tested_at ?? null,
    autoTestOkLastHour: (autoTestRecent ?? []).filter((r) => r.success).length,
    autoTestFailLastHour: (autoTestRecent ?? []).filter((r) => !r.success).length,
  };
}

const STATUS_BADGE_CLASSES = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  muted: 'bg-muted text-muted-foreground border-border',
} as const;

const METRIC_ICON_CLASSES = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'destructive' | 'muted';
  children: React.ReactNode;
}) {
  const cls = STATUS_BADGE_CLASSES[tone];
  return (
    <Badge variant="outline" className={cn('font-medium', cls)}>
      {children}
    </Badge>
  );
}

interface MetricProps {
  icon: React.ElementType;
  label: string;
  value: string;
  badge?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}

function Metric({ icon: iconElement, label, value, badge, tone = 'default' }: MetricProps) {
  const Icon = iconElement;
  const iconCls = METRIC_ICON_CLASSES[tone];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Icon className={cn('h-4 w-4', iconCls)} aria-hidden="true" />
        {badge}
      </div>
      <div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SourceCountChip({
  icon: iconElement,
  tone,
  count,
  label,
  onClick,
  emphasize,
}: {
  icon: React.ElementType;
  tone: 'success' | 'warning' | 'muted';
  count: number;
  label: string;
  onClick: () => void;
  emphasize?: boolean;
}) {
  const Icon = iconElement;
  const cls = {
    success: 'border-success/30 bg-success/10 text-success hover:bg-success/15',
    warning: 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15',
    muted: 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
        cls,
        emphasize && 'ring-1 ring-warning/40',
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="font-semibold">{count}</span> {label}
    </button>
  );
}

export function IntegrationsHealthCard({ secrets = [] }: { secrets?: SecretStatus[] }) {
  const [auditing, setAuditing] = useState(false);
  const { setFilter } = useCredentialsSourceFilter();
  const sourceCounts = useMemo(() => {
    let db = 0,
      env = 0,
      none = 0;
    for (const s of secrets) {
      const src = resolveSource(s);
      if (src === 'db') db++;
      else if (src === 'env') env++;
      else none++;
    }
    return { db, env, none, total: secrets.length };
  }, [secrets]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['integrations-health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const handleAudit = async () => {
    setAuditing(true);
    try {
      const { data: report, error } = await supabase.functions.invoke('connections-hub-audit');
      if (error) throw error;
      const score = report?.score ?? 0;
      const passed = report?.passed ?? 0;
      const total = report?.total ?? 0;
      const msg = `Auditoria: ${score}/10 (${passed}/${total} checks)`;
      if (score >= 8) toast.success(msg);
      else if (score >= 5) toast.warning(msg);
      else toast.error(msg);
    } catch (err) {
      toast.error(`Falha na auditoria: ${toErrorMessage(err)}`);
    } finally {
      setAuditing(false);
    }
  };

  const successTone =
    data?.successRate24h === null
      ? 'default'
      : (data?.successRate24h ?? 0) >= 95
        ? 'success'
        : (data?.successRate24h ?? 0) >= 70
          ? 'warning'
          : 'destructive';

  const failingTone = (data?.failingConnections ?? 0) > 0 ? 'destructive' : 'success';

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            Saúde das Integrações
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={auditing}
              className="h-7 text-xs"
            >
              {auditing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="h-3 w-3" />
              )}
              Rodar auditoria
            </Button>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Atualizar saúde das integrações"
            >
              <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
              {isFetching ? 'Atualizando…' : 'Auto 60s'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data && (data.staleSecrets > 0 || data.autoDisabledWebhooks > 0) && (
          <div className="flex flex-wrap gap-2">
            {data.staleSecrets > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                {data.staleSecrets} {data.staleSecrets === 1 ? 'credencial' : 'credenciais'} sem
                rotação há &gt;90 dias
              </div>
            )}
            {data.autoDisabledWebhooks > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {data.autoDisabledWebhooks} webhook(s) desativados pelo circuit breaker
              </div>
            )}
          </div>
        )}
        {isLoading || !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric
              icon={Webhook}
              label="Webhooks ativos"
              value={`${data.activeWebhooks}/${data.totalWebhooks}`}
              tone={data.activeWebhooks > 0 ? 'success' : 'default'}
            />
            <Metric
              icon={CheckCircle2}
              label={`Sucesso 24h (${data.totalDeliveries24h} envios)`}
              value={data.successRate24h === null ? '—' : `${data.successRate24h.toFixed(1)}%`}
              tone={successTone}
              badge={
                data.successRate24h !== null && (
                  <StatusBadge
                    tone={
                      successTone === 'success'
                        ? 'success'
                        : successTone === 'warning'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {successTone === 'success'
                      ? 'OK'
                      : successTone === 'warning'
                        ? 'Atenção'
                        : 'Crítico'}
                  </StatusBadge>
                )
              }
            />
            <Metric
              icon={Clock}
              label="Última entrega bem-sucedida"
              value={
                data.lastSuccessAt
                  ? formatDistanceToNow(new Date(data.lastSuccessAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })
                  : 'Nunca'
              }
            />
            <Metric
              icon={AlertTriangle}
              label="Conexões com falha"
              value={String(data.failingConnections)}
              tone={failingTone}
              badge={
                data.failingConnections > 0 ? (
                  <StatusBadge tone="destructive">Verificar</StatusBadge>
                ) : (
                  <StatusBadge tone="success">OK</StatusBadge>
                )
              }
            />
            <Metric
              icon={KeyRound}
              label="Chaves MCP usadas (24h)"
              value={String(data.mcpKeysUsed24h)}
              tone={data.mcpKeysUsed24h > 0 ? 'success' : 'default'}
            />
          </div>
        )}
        {sourceCounts.total > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-1 text-[11px]">
            <span className="text-muted-foreground">Origem das credenciais:</span>
            <SourceCountChip
              icon={Database}
              tone="success"
              count={sourceCounts.db}
              label="no banco"
              onClick={() => setFilter('db')}
            />
            <SourceCountChip
              icon={AlertTriangle}
              tone="warning"
              count={sourceCounts.env}
              label={sourceCounts.env === 1 ? 'ainda em ENV' : 'ainda em ENV'}
              onClick={() => setFilter('env')}
              emphasize={sourceCounts.env > 0}
            />
            <SourceCountChip
              icon={Minus}
              tone="muted"
              count={sourceCounts.none}
              label={sourceCounts.none === 1 ? 'vazia' : 'vazias'}
              onClick={() => setFilter('none')}
            />
            {sourceCounts.env > 0 && (
              <span className="ml-1 text-warning">↳ recomendado migrar para o banco</span>
            )}
          </div>
        )}
        {data && (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Bot className="h-3 w-3" aria-hidden="true" />
              Última auto-verificação:{' '}
              <span className="tabular-nums text-foreground">
                {data.lastAutoTestAt
                  ? formatDistanceToNow(new Date(data.lastAutoTestAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })
                  : 'aguardando 1ª execução'}
              </span>
            </span>
            {data.autoTestOkLastHour + data.autoTestFailLastHour > 0 && (
              <span className="tabular-nums">
                Última hora:{' '}
                <span className="font-medium text-success">{data.autoTestOkLastHour} OK</span>
                {data.autoTestFailLastHour > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-destructive">
                      {data.autoTestFailLastHour} falha{data.autoTestFailLastHour === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
