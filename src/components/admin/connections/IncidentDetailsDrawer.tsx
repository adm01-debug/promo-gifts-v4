/**
 * IncidentDetailsDrawer — Onda 14
 *
 * Drawer lateral (Sheet) que mostra métricas e logs filtrados pela janela do
 * incidente (±2h em torno do timestamp). Composição:
 *
 *   1. Header: severidade, título, kind técnico, entidade afetada, janela
 *   2. Resumo de métricas (KPIs em grid 2x4): testes, falhas, taxa, latência
 *      média/p95, entregas, taxa de entregas, primeiro/último evento
 *   3. Abas "Testes de conexão" e "Entregas de webhook" com tabelas paginadas
 *      (últimos N eventos da janela), badges por status, latência colorida
 *
 * Tom de voz: híbrido com tradução (termo técnico + explicação curta entre
 * parênteses).
 */
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Webhook,
  Database,
  Gauge,
  History,
  ArrowUpRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIncidentDetails } from './useIncidentDetails';
import type { IncidentItem, IncidentSeverity } from './useRecentIncidents';

const SEV_META: Record<
  IncidentSeverity,
  { label: string; icon: typeof AlertOctagon; cls: string; description: string }
> = {
  P0: {
    label: 'P0 · Crítico',
    icon: AlertOctagon,
    cls: 'bg-destructive/10 text-destructive border-destructive/30',
    description: 'Severidade P0 (crítico): impacto imediato — exige intervenção agora',
  },
  P1: {
    label: 'P1 · Atenção',
    icon: AlertTriangle,
    cls: 'bg-warning/10 text-warning border-warning/30',
    description: 'Severidade P1 (atenção): degradação visível — monitorar e planejar correção',
  },
  P2: {
    label: 'P2 · Info',
    icon: Info,
    cls: 'bg-muted text-muted-foreground border-border',
    description: 'Severidade P2 (informacional): registro sem impacto operacional',
  },
};

interface Props {
  incident: IncidentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METRIC_TILE_CLASSES = {
  default: { icon: 'text-muted-foreground', value: 'text-foreground' },
  success: { icon: 'text-success', value: 'text-success' },
  warning: { icon: 'text-warning', value: 'text-warning' },
  destructive: { icon: 'text-destructive', value: 'text-destructive' },
} as const;

function MetricTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: 'default' | 'destructive' | 'success' | 'warning';
  hint?: string;
}) {
  const cls = METRIC_TILE_CLASSES[tone];
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', cls.icon)} aria-hidden="true" />
        <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-base font-bold tabular-nums leading-tight', cls.value)}>{value}</p>
      {hint && <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusPill({ ok, code }: { ok: boolean; code: number | null }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 gap-1 px-1.5 font-mono text-[10px]',
        ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {code ?? (ok ? 'OK' : 'ERR')}
    </Badge>
  );
}

function LatencyCell({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = ms < 500 ? 'text-success' : ms < 1500 ? 'text-warning' : 'text-destructive';
  return <span className={cn('font-mono text-xs tabular-nums', tone)}>{ms}ms</span>;
}

export function IncidentDetailsDrawer({ incident, open, onOpenChange }: Props) {
  const { data, isLoading } = useIncidentDetails(
    incident
      ? {
          occurredAt: incident.occurredAt,
          entityId: incident.entityId,
          kind: incident.kind,
          windowMinutes: 120,
        }
      : null,
  );

  if (!incident) return null;
  const sev = SEV_META[incident.severity];
  const SevIcon = sev.icon;
  const occurred = new Date(incident.occurredAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
        aria-describedby="incident-details-desc"
      >
        <TooltipProvider>
          <SheetHeader className="space-y-2 border-b border-border/40 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('gap-1 text-[11px] font-semibold', sev.cls)}>
                <SevIcon className="h-3 w-3" />
                {sev.label}
              </Badge>
              {incident.kind && (
                <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                  {incident.kind}
                </Badge>
              )}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                {incident.source === 'notification' ? 'alerta consolidado' : 'evento bruto'}
              </Badge>
            </div>
            <SheetTitle className="text-base leading-tight">{incident.title}</SheetTitle>
            <SheetDescription id="incident-details-desc" className="text-xs">
              {incident.subtitle}
            </SheetDescription>
            <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(occurred, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </span>
              <span>·</span>
              <span>{formatDistanceToNow(occurred, { locale: ptBR, addSuffix: true })}</span>
              {data?.entity && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    {data.entity.kind === 'webhook' ? (
                      <Webhook className="h-3 w-3" />
                    ) : (
                      <Database className="h-3 w-3" />
                    )}
                    <span className="font-medium text-foreground">{data.entity.name}</span>
                    {data.entity.type && (
                      <span className="text-muted-foreground">({data.entity.type})</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </SheetHeader>

          {/* MÉTRICAS na janela */}
          <section aria-label="Métricas da janela do incidente" className="space-y-3 py-4">
            <header className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                Métricas na janela (±2h em torno do incidente)
              </h3>
              {data?.metrics && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {format(new Date(data.metrics.windowStart), 'HH:mm', { locale: ptBR })} —{' '}
                  {format(new Date(data.metrics.windowEnd), 'HH:mm', { locale: ptBR })}
                </span>
              )}
            </header>
            {isLoading || !data ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricTile
                  icon={Activity}
                  label="Testes (runs)"
                  value={String(data.metrics.testCount)}
                />
                <MetricTile
                  icon={CheckCircle2}
                  label="Sucesso"
                  value={String(data.metrics.testSuccess)}
                  tone={data.metrics.testSuccess > 0 ? 'success' : 'default'}
                />
                <MetricTile
                  icon={XCircle}
                  label="Falhas"
                  value={String(data.metrics.testFail)}
                  tone={data.metrics.testFail > 0 ? 'destructive' : 'default'}
                />
                <MetricTile
                  icon={Gauge}
                  label="Taxa de sucesso"
                  value={
                    data.metrics.testSuccessRate === null
                      ? '—'
                      : `${data.metrics.testSuccessRate.toFixed(1)}%`
                  }
                  tone={
                    data.metrics.testSuccessRate === null
                      ? 'default'
                      : data.metrics.testSuccessRate >= 95
                        ? 'success'
                        : data.metrics.testSuccessRate >= 70
                          ? 'warning'
                          : 'destructive'
                  }
                />
                <MetricTile
                  icon={Clock}
                  label="Latência média"
                  value={
                    data.metrics.testAvgLatency === null ? '—' : `${data.metrics.testAvgLatency}ms`
                  }
                  hint="média aritmética dos testes na janela"
                />
                <MetricTile
                  icon={Clock}
                  label="P95 (95º percentil)"
                  value={
                    data.metrics.testP95Latency === null ? '—' : `${data.metrics.testP95Latency}ms`
                  }
                  hint="95% das requisições foram mais rápidas que esse valor"
                />
                <MetricTile
                  icon={Webhook}
                  label="Entregas (webhook)"
                  value={String(data.metrics.deliveryCount)}
                  hint={
                    data.metrics.deliverySuccessRate === null
                      ? 'sem entregas na janela'
                      : `${data.metrics.deliverySuccessRate.toFixed(1)}% sucesso`
                  }
                />
                <MetricTile
                  icon={History}
                  label="Último evento"
                  value={
                    data.metrics.lastEventAt
                      ? formatDistanceToNow(new Date(data.metrics.lastEventAt), {
                          locale: ptBR,
                          addSuffix: true,
                        })
                      : '—'
                  }
                />
              </div>
            )}
          </section>

          {/* LOGS filtrados */}
          <section aria-label="Logs filtrados pela janela" className="space-y-3 pb-6">
            <Tabs defaultValue="tests">
              <TabsList className="h-8">
                <TabsTrigger value="tests" className="h-7 text-xs">
                  Testes ({data?.tests.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="deliveries" className="h-7 text-xs">
                  Entregas ({data?.deliveries.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tests" className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : data?.tests.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhum teste registrado nesta janela.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[10px]">
                          <TableHead className="h-8">Quando</TableHead>
                          <TableHead className="h-8">Status</TableHead>
                          <TableHead className="h-8">Latência</TableHead>
                          <TableHead className="h-8">Origem</TableHead>
                          <TableHead className="h-8">Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.tests.slice(0, 50).map((t) => (
                          <TableRow key={t.id} className="text-xs">
                            <TableCell className="whitespace-nowrap py-1.5 font-mono tabular-nums">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    {format(new Date(t.tested_at), 'HH:mm:ss', { locale: ptBR })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {format(new Date(t.tested_at), 'dd/MM/yyyy HH:mm:ss', {
                                    locale: ptBR,
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <StatusPill ok={t.success} code={t.status_code} />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <LatencyCell ms={t.latency_ms} />
                              {t.attempts > 1 && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  ×{t.attempts}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <span className="text-[10px] capitalize text-muted-foreground">
                                {t.triggered_by}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px] py-1.5">
                              {t.error_message ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate text-[10px] text-destructive">
                                      {t.error_kind && (
                                        <span className="font-mono">[{t.error_kind}]</span>
                                      )}{' '}
                                      {t.error_message}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="whitespace-pre-wrap text-xs">{t.error_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deliveries" className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : data?.deliveries.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhuma entrega de webhook nesta janela.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[10px]">
                          <TableHead className="h-8">Quando</TableHead>
                          <TableHead className="h-8">Evento</TableHead>
                          <TableHead className="h-8">Status</TableHead>
                          <TableHead className="h-8">Tentativa</TableHead>
                          <TableHead className="h-8">Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.deliveries.slice(0, 50).map((d) => (
                          <TableRow key={d.id} className="text-xs">
                            <TableCell className="whitespace-nowrap py-1.5 font-mono tabular-nums">
                              {format(new Date(d.delivered_at), 'HH:mm:ss', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="py-1.5 font-mono text-[10px]">
                              {d.event}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <StatusPill ok={d.success} code={d.status_code} />
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] text-muted-foreground">
                              #{d.attempt}
                            </TableCell>
                            <TableCell className="max-w-[200px] py-1.5">
                              {d.error_message ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate text-[10px] text-destructive">
                                      {d.error_message}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="whitespace-pre-wrap text-xs">{d.error_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {incident.actionUrl && (
              <a
                href={incident.actionUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Abrir alerta original <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </section>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
