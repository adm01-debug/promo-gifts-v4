/**
 * EdgeInvokeLivePanel — Onda 21
 * ----------------------------------------------------------------
 * Painel live-only (client-side) que consome o `invokeTelemetrySink`
 * e mostra a saúde da superfície `invokeEdgeSafe` na sessão atual:
 *   - KPIs (chamadas na janela, %erro, breaker opens, p95 global)
 *   - Tabela por edge function (total, ok, failed, breaker, p50/p95/p99)
 *
 * Não depende da RPC `get_edge_invoke_summary` (draft, REGRA #1). Assim
 * que a RPC for aplicada, o `AppHealthDashboard` cobre a visão histórica
 * server-side; este painel continua útil p/ debugging local em tempo real.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Radio,
  Zap,
  AlertTriangle,
  ShieldAlert,
  Timer,
  Trash2,
  Download,
  Copy,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  buildDownloadFilename,
  copyRequestId,
  emitRequestIdLookup,
  invokeEventsToCSV,
  invokeEventsToJSON,
  triggerDownload,
} from '@/lib/edge/invokeExport';
import { shortRequestId } from '@/lib/telemetry/requestId';
import {
  aggregateInvokeEvents,
  clearInvokeSink,
  getInvokeEventsSnapshot,
  subscribeInvokeSink,
  type InvokeGlobalSummary,
} from '@/lib/edge/invokeTelemetrySink';
import { rankBottlenecks, rollupByCategory } from '@/lib/edge/invokeBottlenecks';

const WINDOW_OPTIONS = [
  { value: 60_000, label: '1min' },
  { value: 5 * 60_000, label: '5min' },
  { value: 15 * 60_000, label: '15min' },
  { value: 60 * 60_000, label: '1h' },
] as const;

type WindowMs = (typeof WINDOW_OPTIONS)[number]['value'];

function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${n}ms`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function EdgeInvokeLivePanel() {
  const [windowMs, setWindowMs] = useState<WindowMs>(5 * 60_000);
  const [tick, setTick] = useState(0);

  const events = useSyncExternalStore(
    subscribeInvokeSink,
    getInvokeEventsSnapshot,
    getInvokeEventsSnapshot,
  );

  const summary: InvokeGlobalSummary = useMemo(
    () => aggregateInvokeEvents(events, Date.now(), windowMs),
    // `tick` força reagregar quando o usuário troca a janela sem novo evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, windowMs, tick],
  );

  const p95Global = useMemo(() => {
    const values = summary.fns
      .flatMap((f) => (f.p95Ms !== null ? [f.p95Ms] : []))
      .sort((a, b) => a - b);
    if (!values.length) return null;
    return values[Math.floor(values.length * 0.5)] ?? null;
  }, [summary]);

  const errorTone =
    summary.errorRatio >= 0.05
      ? 'destructive'
      : summary.errorRatio >= 0.01
        ? 'warning'
        : 'muted';

  return (
    <section
      data-testid="edge-invoke-live-panel"
      className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:space-y-4 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">
              Edge Invokes (live)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Telemetria in-memory da superfície{' '}
              <code className="text-[10px]">invokeEdgeSafe</code> — sessão atual, últimos{' '}
              {WINDOW_OPTIONS.find((o) => o.value === windowMs)?.label}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={String(windowMs)}
            onValueChange={(v) => {
              if (!v) return;
              setWindowMs(Number(v) as WindowMs);
              setTick((t) => t + 1);
            }}
            size="sm"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={String(opt.value)}
                className="h-7 px-2 text-xs"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!events.length) {
                toast.info('Nada para exportar');
                return;
              }
              triggerDownload(
                buildDownloadFilename('csv'),
                invokeEventsToCSV(events),
                'text/csv;charset=utf-8',
              );
              toast.success(`CSV exportado (${events.length} eventos)`);
            }}
            data-testid="edge-invoke-live-export-csv"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!events.length) {
                toast.info('Nada para exportar');
                return;
              }
              triggerDownload(
                buildDownloadFilename('json'),
                invokeEventsToJSON(events),
                'application/json',
              );
              toast.success(`JSON exportado (${events.length} eventos)`);
            }}
            data-testid="edge-invoke-live-export-json"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearInvokeSink()}
            data-testid="edge-invoke-live-clear"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniKpi
          icon={<Zap className="h-4 w-4" />}
          label="Chamadas"
          value={summary.totalStart.toLocaleString('pt-BR')}
          hint={`${summary.totalOk} ok · ${summary.totalFailed} falha`}
        />
        <MiniKpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="% erro"
          value={fmtPct(summary.errorRatio)}
          tone={errorTone}
        />
        <MiniKpi
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Breaker"
          value={summary.totalBreakerOpen.toLocaleString('pt-BR')}
          tone={summary.totalBreakerOpen > 0 ? 'warning' : 'muted'}
          hint="disparos na janela"
        />
        <MiniKpi
          icon={<Timer className="h-4 w-4" />}
          label="p95 (mediana)"
          value={fmtMs(p95Global)}
          hint="p95 mediano entre fns"
        />
      </div>

      {/* Tabela por edge fn */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Por edge function</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/40">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Function</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  <th className="px-2 py-1.5 text-right">OK</th>
                  <th className="px-2 py-1.5 text-right">Falha</th>
                  <th className="px-2 py-1.5 text-right">Breaker</th>
                  <th className="px-2 py-1.5 text-right">% erro</th>
                  <th className="px-2 py-1.5 text-right">p50</th>
                  <th className="px-2 py-1.5 text-right">p95</th>
                  <th className="px-2 py-1.5 text-right">p99</th>
                </tr>
              </thead>
              <tbody>
                {summary.fns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-6 text-center text-muted-foreground"
                      data-testid="edge-invoke-live-empty"
                    >
                      Sem chamadas registradas na janela.
                    </td>
                  </tr>
                ) : (
                  summary.fns.map((f) => (
                    <tr key={f.fn} className="border-t border-border/40">
                      <td className="max-w-[220px] truncate px-2 py-1.5 font-mono" title={f.fn}>
                        {f.fn}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{f.total}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{f.ok}</td>
                      <td
                        className={cn(
                          'px-2 py-1.5 text-right tabular-nums',
                          f.failed > 0 && 'font-semibold text-destructive',
                        )}
                      >
                        {f.failed}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-1.5 text-right tabular-nums',
                          f.breakerOpen > 0 && 'font-semibold text-warning',
                        )}
                      >
                        {f.breakerOpen}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        <Badge
                          variant={
                            f.errorRatio >= 0.05
                              ? 'destructive'
                              : f.errorRatio > 0
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {fmtPct(f.errorRatio)}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMs(f.p50Ms)}</td>
                      <td
                        className={cn(
                          'px-2 py-1.5 text-right tabular-nums',
                          f.p95Ms !== null && f.p95Ms >= 2000 && 'font-semibold text-destructive',
                          f.p95Ms !== null &&
                            f.p95Ms >= 1000 &&
                            f.p95Ms < 2000 &&
                            'text-warning',
                        )}
                      >
                        {fmtMs(f.p95Ms)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMs(f.p99Ms)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Eventos recentes — copiar request-id / deep-link para lookup histórico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Eventos recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[280px] overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/40">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Quando</th>
                  <th className="px-2 py-1.5">Kind</th>
                  <th className="px-2 py-1.5">Function</th>
                  <th className="px-2 py-1.5">request-id</th>
                  <th className="px-2 py-1.5 text-right">Latência</th>
                  <th className="px-2 py-1.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody data-testid="edge-invoke-live-events">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Sem eventos capturados nesta sessão.
                    </td>
                  </tr>
                ) : (
                  events
                    .slice(-20)
                    .reverse()
                    .map((ev, i) => (
                      <tr key={`${ev.ts}-${i}`} className="border-t border-border/40">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                          {new Date(ev.ts).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge
                            variant={
                              ev.kind === 'failed'
                                ? 'destructive'
                                : ev.kind === 'breaker_open'
                                  ? 'secondary'
                                  : ev.kind === 'ok'
                                    ? 'outline'
                                    : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {ev.kind}
                          </Badge>
                        </td>
                        <td className="max-w-[180px] truncate px-2 py-1.5 font-mono" title={ev.fn}>
                          {ev.fn}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10px]" title={ev.requestId}>
                          {shortRequestId(ev.requestId)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {fmtMs(ev.latencyMs)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label="Copiar request-id"
                              onClick={async () => {
                                const ok = await copyRequestId(ev.requestId);
                                if (ok) toast.success('request-id copiado');
                                else toast.error('Falha ao copiar');
                              }}
                              data-testid={`edge-invoke-live-copy-${i}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label="Buscar no histórico"
                              onClick={() => {
                                emitRequestIdLookup(ev.requestId);
                                toast.info('Enviando para o lookup histórico…');
                              }}
                              data-testid={`edge-invoke-live-lookup-${i}`}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

interface MiniKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'muted' | 'warning' | 'destructive';
}

function MiniKpi({ icon, label, value, hint, tone = 'muted' }: MiniKpiProps) {
  const toneCls =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-foreground';
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 font-display text-xl font-bold tabular-nums', toneCls)}>
        {value}
      </div>
      {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
