import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Activity, AlertTriangle, Gauge, Search, Webhook, Zap, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAppHealth,
  lookupRequestId,
  type HealthWindow,
  type RequestIdLookup,
} from '@/pages/admin/telemetry/useAppHealth';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ============================================================================
// AppHealthDashboard — KPIs de saúde da plataforma
// ----------------------------------------------------------------------------
// • 4 KPI cards (req/min, %4xx, %5xx, p95/p99)
// • Top rotas por erro
// • Webhooks por source × direction (taxa de falha)
// • Edge functions por latência (p50/p95/p99)
// • Lookup por X-Request-Id → timeline cross-camada
// ============================================================================

const WINDOW_OPTIONS: { value: HealthWindow; label: string }[] = [
  { value: 15, label: '15min' },
  { value: 60, label: '1h' },
  { value: 360, label: '6h' },
  { value: 1440, label: '24h' },
];

function fmtMs(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${n}ms`;
}

function statusTone(rate: number, warn = 1, danger = 5) {
  if (rate >= danger) return 'destructive';
  if (rate >= warn) return 'warning';
  return 'muted';
}

export function AppHealthDashboard() {
  const [windowMinutes, setWindowMinutes] = useState<HealthWindow>(60);
  const [requestIdQuery, setRequestIdQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<RequestIdLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const { data, isLoading, isFetching, refetch } = useAppHealth(windowMinutes);

  const handleLookup = async () => {
    const id = requestIdQuery.trim();
    if (!id) return;
    setLookupLoading(true);
    try {
      const res = await lookupRequestId(id);
      setLookupResult(res);
      if (res.event_count === 0) {
        toast.info('Nenhum evento encontrado para este request-id');
      }
    } catch {
      toast.error('Falha no lookup');
    } finally {
      setLookupLoading(false);
    }
  };

  const kpis = data?.kpis;
  const topRoutesByError = data?.top_routes_by_error ?? [];
  const webhooksBySource = data?.webhooks_by_source ?? [];
  const edgesByLatency = data?.edges_by_latency ?? [];
  const tone4xx = statusTone(kpis?.pct_4xx ?? 0, 5, 15);
  const tone5xx = statusTone(kpis?.pct_5xx ?? 0, 1, 5);

  return (
    <section
      id="saude-aplicacao"
      data-testid="app-health-dashboard"
      className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:space-y-4 sm:p-4"
    >
      {/* Header da seção */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">Saúde da Aplicação</h2>
            <p className="text-[11px] text-muted-foreground">
              KPIs de 4xx/5xx por rota, falha de webhooks e latência por edge function
              (correlacionados por <code className="text-[10px]">X-Request-Id</code>).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={String(windowMinutes)}
            onValueChange={(v) => v && setWindowMinutes(Number(v) as HealthWindow)}
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
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <KpiCard
              icon={<Gauge className="h-5 w-5" />}
              label="Req/min"
              value={kpis.req_per_min.toLocaleString('pt-BR')}
              sub={`${kpis.total.toLocaleString('pt-BR')} eventos · janela ${windowMinutes}min`}
            />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="% 4xx"
              value={`${kpis.pct_4xx.toFixed(2)}%`}
              tone={tone4xx}
              sub="Erros de cliente"
            />
            <KpiCard
              icon={<Zap className="h-5 w-5" />}
              label="% 5xx"
              value={`${kpis.pct_5xx.toFixed(2)}%`}
              tone={tone5xx}
              sub="Erros de servidor"
            />
            <KpiCard
              icon={<Timer className="h-5 w-5" />}
              label="Latência p95"
              value={fmtMs(kpis.p95_ms)}
              sub={`p99: ${fmtMs(kpis.p99_ms)}`}
            />
          </>
        )}
      </div>

      {/* Lookup por request-id */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Search className="h-4 w-4 text-primary" />
            Lookup por X-Request-Id
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Cole o request-id (ex: 2c5b…-uuid)"
              value={requestIdQuery}
              onChange={(e) => setRequestIdQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              data-testid="app-health-request-id-input"
              className="font-mono text-xs"
            />
            <Button onClick={handleLookup} disabled={lookupLoading || !requestIdQuery.trim()}>
              Buscar
            </Button>
          </div>
          {lookupResult && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                <strong>{lookupResult.event_count}</strong> evento(s) correlacionado(s) —
                request_id: <code className="font-mono">{lookupResult.request_id}</code>
              </div>
              {lookupResult.event_count > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="px-2 py-1.5">Hora</th>
                        <th className="px-2 py-1.5">Source</th>
                        <th className="px-2 py-1.5">Dir</th>
                        <th className="px-2 py-1.5">Endpoint</th>
                        <th className="px-2 py-1.5 text-right">Status</th>
                        <th className="px-2 py-1.5 text-right">Dur</th>
                        <th className="px-2 py-1.5">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookupResult.webhook_events.map((ev, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono">
                            {format(new Date(ev.occurred_at), 'HH:mm:ss.SSS')}
                          </td>
                          <td className="px-2 py-1.5">{ev.source}</td>
                          <td className="px-2 py-1.5">{ev.direction}</td>
                          <td
                            className="max-w-[280px] truncate px-2 py-1.5"
                            title={ev.endpoint ?? ''}
                          >
                            {ev.endpoint ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <StatusBadge status={ev.http_status} success={ev.success} />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {fmtMs(ev.duration_ms)}
                          </td>
                          <td
                            className="max-w-[260px] truncate px-2 py-1.5 text-destructive"
                            title={ev.error_message ?? ''}
                          >
                            {ev.error_class || ev.error_message || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3 tabelas em grid */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Top rotas por erro */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Top rotas por erro
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[360px] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/40">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Endpoint</th>
                    <th className="px-2 py-1.5 text-right">4xx</th>
                    <th className="px-2 py-1.5 text-right">5xx</th>
                    <th className="px-2 py-1.5 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-3">
                        <Skeleton className="h-20 w-full" />
                      </td>
                    </tr>
                  ) : topRoutesByError.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-muted-foreground">
                        Sem erros na janela
                      </td>
                    </tr>
                  ) : (
                    topRoutesByError.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="max-w-[220px] truncate px-2 py-1.5" title={r.endpoint}>
                          {r.endpoint}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({r.direction})
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.count_4xx}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-destructive">
                          {r.count_5xx}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          <Badge
                            variant={r.error_rate_pct >= 10 ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {r.error_rate_pct.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks por source */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Webhook className="h-4 w-4 text-primary" />
              Webhooks (source × direction)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[360px] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/40">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Source</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                    <th className="px-2 py-1.5 text-right">Falhas</th>
                    <th className="px-2 py-1.5 text-right">p95</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-3">
                        <Skeleton className="h-20 w-full" />
                      </td>
                    </tr>
                  ) : webhooksBySource.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-muted-foreground">
                        Sem webhooks na janela
                      </td>
                    </tr>
                  ) : (
                    webhooksBySource.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1.5">
                          {r.source}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({r.direction})
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          <span className={cn(r.failures > 0 && 'font-semibold text-destructive')}>
                            {r.failures}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({r.failure_rate_pct.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtMs(r.p95_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edges por latência */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-warning" />
              Edge functions (latência)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[360px] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/40">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Edge fn</th>
                    <th className="px-2 py-1.5 text-right">p50</th>
                    <th className="px-2 py-1.5 text-right">p95</th>
                    <th className="px-2 py-1.5 text-right">p99</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-3">
                        <Skeleton className="h-20 w-full" />
                      </td>
                    </tr>
                  ) : edgesByLatency.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-muted-foreground">
                        Sem dados na janela
                      </td>
                    </tr>
                  ) : (
                    edgesByLatency.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="max-w-[180px] truncate px-2 py-1.5" title={r.edge_function}>
                          {r.edge_function}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({r.total})
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtMs(r.p50_ms)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          <span
                            className={cn(
                              r.p95_ms >= 2000 && 'font-semibold text-destructive',
                              r.p95_ms >= 1000 && r.p95_ms < 2000 && 'text-warning',
                            )}
                          >
                            {fmtMs(r.p95_ms)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtMs(r.p99_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = 'muted',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'muted' | 'warning' | 'destructive';
}) {
  return (
    <Card
      className={cn(
        'border-[1.5px] transition-colors',
        tone === 'destructive' && 'border-destructive/40 bg-destructive/5',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
      )}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'rounded-lg p-2',
            tone === 'destructive' && 'bg-destructive/15 text-destructive',
            tone === 'warning' && 'bg-warning/15 text-warning',
            tone === 'muted' && 'bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p
            className={cn(
              'truncate font-display text-2xl font-bold tabular-nums leading-tight',
              tone === 'destructive' && 'text-destructive',
              tone === 'warning' && 'text-warning',
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, success }: { status: number | null; success: boolean }) {
  if (status === null) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        {success ? 'ok' : 'fail'}
      </Badge>
    );
  }
  const variant: 'default' | 'destructive' | 'secondary' =
    status >= 400 ? 'destructive' : 'secondary';
  return (
    <Badge variant={variant} className="text-[10px] tabular-nums">
      {status}
    </Badge>
  );
}
