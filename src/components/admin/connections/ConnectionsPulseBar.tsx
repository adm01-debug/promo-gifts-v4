/**
 * ConnectionsPulseBar — Onda 14
 *
 * Barra sticky no topo de /admin/conexoes com:
 *  - Severidade global P0/P1/P2 (Status Pulse)
 *  - Headline contextual + tooltip com motivos detalhados
 *  - 4 KPIs resumidos (Webhooks ativos, Sucesso 24h, Conexões com falha, Última entrega)
 *  - Botão de refresh manual
 *
 * Tom de voz: híbrido com tradução (termo técnico + explicação curta).
 */
import {
  type Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Webhook,
  Clock,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePulseBarStatus, type PulseSeverity } from './usePulseBarStatus';
import { useExplainMode } from './ExplainModeContext';
import { KpiExplainTooltip, type KpiExplain } from './KpiExplainTooltip';

const SEVERITY_META: Record<
  PulseSeverity,
  {
    label: string;
    tone: string;
    icon: typeof CheckCircle2;
    pulseColor: string;
    description: string;
  }
> = {
  P0: {
    label: 'P0 · Crítico',
    tone: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: AlertOctagon,
    pulseColor: 'bg-destructive',
    description:
      'Severidade P0 (crítico): impacto imediato no fluxo de integrações — exige intervenção agora',
  },
  P1: {
    label: 'P1 · Atenção',
    tone: 'bg-warning/10 text-warning border-warning/30',
    icon: AlertTriangle,
    pulseColor: 'bg-warning',
    description: 'Severidade P1 (atenção): degradação visível — monitorar e planejar correção',
  },
  P2: {
    label: 'P2 · Estável',
    tone: 'bg-success/10 text-success border-success/30',
    icon: CheckCircle2,
    pulseColor: 'bg-success',
    description: 'Severidade P2 (estável): tudo dentro dos limites operacionais',
  },
};

const MINI_KPI_ICON_CLASSES = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

const MINI_KPI_VALUE_CLASSES = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

function MiniKpi({
  icon: iconComponent,
  label,
  value,
  tone = 'default',
  tooltip,
  explain,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: 'default' | 'destructive' | 'success' | 'warning';
  tooltip?: string;
  explain?: KpiExplain;
}) {
  const { enabled: explainOn } = useExplainMode();
  const Icon = iconComponent;
  const iconCls = MINI_KPI_ICON_CLASSES[tone];
  const valueCls = MINI_KPI_VALUE_CLASSES[tone];

  const content = (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md border bg-background/60 px-2.5 py-1 transition-colors',
        explainOn && explain ? 'border-primary/40 bg-primary/5' : 'border-border/40',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconCls)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={cn('truncate text-xs font-semibold tabular-nums', valueCls)}>{value}</span>
        <span className="truncate text-[10px] text-muted-foreground">{label}</span>
      </div>
      {explainOn && explain && <KpiExplainTooltip explain={explain} className="ml-0.5 shrink-0" />}
    </div>
  );

  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-left">
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs leading-relaxed">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ConnectionsPulseBar() {
  const { data, isFetching, refetch } = usePulseBarStatus();

  const severity: PulseSeverity = data?.severity ?? 'P2';
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;

  const successRate = data?.kpis.successRate24h ?? null;
  const successTone =
    successRate === null
      ? 'default'
      : successRate >= 95
        ? 'success'
        : successRate >= 70
          ? 'warning'
          : 'destructive';
  const failingTone = (data?.kpis.failingConnections ?? 0) > 0 ? 'destructive' : 'success';
  const webhookTone = (data?.kpis.activeWebhooks ?? 0) > 0 ? 'success' : 'default';

  return (
    <TooltipProvider>
      <div
        role="status"
        aria-live="polite"
        aria-label={`Status global das integrações: ${meta.label}. ${data?.headline ?? ''}`}
        className={cn(
          'sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 -mx-4 px-4 py-2.5 md:-mx-6 md:px-6',
          'border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70',
          'transition-colors duration-300',
          severity === 'P0' && 'border-destructive/30',
          severity === 'P1' && 'border-warning/30',
          severity === 'P2' && 'border-border',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Status pulse + headline */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                  {severity !== 'P2' && (
                    <span
                      className={cn(
                        'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                        meta.pulseColor,
                      )}
                    />
                  )}
                  <span
                    className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', meta.pulseColor)}
                  />
                </span>
                <Badge
                  variant="outline"
                  className={cn('gap-1 text-[11px] font-semibold', meta.tone)}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {data?.headline ?? 'Carregando status…'}
                  </p>
                  {data && data.reasons.length > 0 && (
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {data.reasons[0]}
                      {data.reasons.length > 1 && ` · +${data.reasons.length - 1}`}
                    </p>
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="mb-1 text-xs font-semibold">{meta.description}</p>
              {data && data.reasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {data.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem alertas ativos no momento.</p>
              )}
            </TooltipContent>
          </Tooltip>

          {/* Spacer */}
          <div className="min-w-0 flex-1" />

          {/* KPIs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <MiniKpi
              icon={Webhook}
              label="Webhooks ativos"
              value={data ? `${data.kpis.activeWebhooks}/${data.kpis.totalWebhooks}` : '—'}
              tone={webhookTone}
              tooltip="Webhooks de saída habilitados (active=true) sobre o total cadastrado"
              explain={{
                summary: 'Webhooks ativos vs. total cadastrado',
                formula: 'count(active=true) / count(*)',
                window: 'Snapshot atual (sem janela temporal)',
                source: 'outbound_webhooks.active',
                threshold: 'Esperado: ≥1 ativo se há integrações em uso',
              }}
            />
            <MiniKpi
              icon={CheckCircle2}
              label={`Sucesso 24h${data ? ` · ${data.kpis.totalDeliveries24h} envios` : ''}`}
              value={successRate === null ? '—' : `${successRate.toFixed(1)}%`}
              tone={successTone}
              tooltip="Taxa de entrega bem-sucedida (HTTP 2xx) nas últimas 24 horas. Alvo ≥95%."
              explain={{
                summary: 'Taxa de entregas de webhook bem-sucedidas',
                formula: 'count(success=true) / count(*) × 100',
                window: 'Últimas 24h (delivered_at ≥ now()-24h)',
                source: 'webhook_deliveries.success, .delivered_at',
                threshold: '≥95% verde · 70–95% atenção · <70% crítico',
              }}
            />
            <MiniKpi
              icon={XCircle}
              label="Conexões em falha"
              value={data ? String(data.kpis.failingConnections) : '—'}
              tone={failingTone}
              tooltip="Conexões cujo último teste (last_test_ok) retornou falha. Pode ser flap pontual; veja o banner de alerta para janela contínua."
              explain={{
                summary: 'Conexões cujo último teste de saúde falhou',
                formula: 'count(last_test_ok = false)',
                window: 'Último teste registrado (auto-test a cada N min ou manual)',
                source: 'external_connections.last_test_ok',
                threshold: '0 ideal · ≥1 sustentado pela janela vira P0',
              }}
            />
            <MiniKpi
              icon={Clock}
              label="Última entrega OK"
              value={
                data?.kpis.lastSuccessAt
                  ? formatDistanceToNow(new Date(data.kpis.lastSuccessAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })
                  : '—'
              }
              tooltip="Quando ocorreu a última entrega de webhook bem-sucedida (latest delivered_at com success=true)"
              explain={{
                summary: 'Heartbeat: última entrega de webhook com sucesso',
                formula: 'max(delivered_at) where success = true',
                window: 'Histórico completo (sem corte temporal)',
                source: 'webhook_deliveries.delivered_at, .success',
                threshold: 'Recente (<1h) saudável · >24h sugere fluxo parado',
              }}
            />
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-1 inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Atualizar status global"
            >
              <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
              <span>{isFetching ? 'Atualizando…' : 'Auto 60s'}</span>
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
