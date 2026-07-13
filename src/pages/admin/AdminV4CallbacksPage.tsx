/**
 * /admin/v4-callbacks
 * ------------------------------------------------------------------
 * Painel de observabilidade e operação dos callbacks CRM → V4:
 *   - Gráficos por período (sent_ok / failed / exhausted / duplicate)
 *   - Filtros: external_quote_id, event_type, result, janela temporal
 *   - Botão reprocessar dead-letters (por linha e em lote)
 *   - Exportação CSV
 */
import { useMemo, useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { Activity, Download, RefreshCw, RotateCw, Search } from 'lucide-react';
import {
  useV4Callbacks,
  useCallbackBuckets,
  useReprocessCallback,
  useReprocessMany,
  downloadCSV,
  type CallbackFilters,
  type EventType,
  type CallbackResult,
} from '@/hooks/admin/useV4Callbacks';

const EVENT_TYPES: Array<EventType | 'all'> = [
  'all',
  'approved',
  'rejected',
  'order_created',
  'sent_to_client',
  'expired',
];
const RESULTS: Array<CallbackResult | 'all'> = [
  'all',
  'applied',
  'error',
  'exhausted',
  'duplicate_ignored',
];
const WINDOWS: Array<{ label: string; hours: number }> = [
  { label: 'Última 1h', hours: 1 },
  { label: 'Últimas 6h', hours: 6 },
  { label: 'Últimas 24h', hours: 24 },
  { label: 'Últimos 7d', hours: 24 * 7 },
];

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    applied: { cls: 'border-success/30 bg-success/10 text-success', label: 'sent_ok' },
    error: { cls: 'border-destructive/30 bg-destructive/10 text-destructive', label: 'failed' },
    exhausted: { cls: 'border-warning/30 bg-warning/10 text-warning', label: 'exhausted' },
    duplicate_ignored: { cls: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground', label: 'duplicate' },
  };
  const v = map[result] ?? { cls: 'border-muted-foreground/30 bg-muted/40', label: result };
  return (
    <Badge variant="outline" className={v.cls}>
      {v.label}
    </Badge>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminV4CallbacksPage() {
  const [externalQuoteId, setExternalQuoteId] = useState('');
  const [eventType, setEventType] = useState<EventType | 'all'>('all');
  const [result, setResult] = useState<CallbackResult | 'all'>('all');
  const [windowHours, setWindowHours] = useState(24);

  const filters: CallbackFilters = useMemo(
    () => ({
      externalQuoteId: externalQuoteId || undefined,
      eventType,
      result,
      since: new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString(),
      limit: 1000,
    }),
    [externalQuoteId, eventType, result, windowHours],
  );

  const { data, isLoading, isFetching, refetch, error } = useV4Callbacks(filters);
  const buckets = useCallbackBuckets(data, windowHours <= 24 ? 'hour' : 'day');
  const reprocess = useReprocessCallback();
  const reprocessMany = useReprocessMany();

  const totals = useMemo(() => {
    const acc = { sent_ok: 0, failed: 0, exhausted: 0, duplicate: 0, total: 0 };
    for (const r of data ?? []) {
      acc.total++;
      if (r.result === 'applied') acc.sent_ok++;
      else if (r.result === 'exhausted') acc.exhausted++;
      else if (r.result === 'duplicate_ignored') acc.duplicate++;
      else acc.failed++;
    }
    return acc;
  }, [data]);

  const failureRate = totals.total > 0 ? (100 * (totals.failed + totals.exhausted)) / totals.total : 0;

  async function handleReprocessOne(id: string) {
    try {
      await reprocess.mutateAsync(id);
      toast.success('Callback reprocessado.');
    } catch (e) {
      toast.error('Falha ao reprocessar.', { description: sanitizeError(e) });
    }
  }
  async function handleReprocessBatch() {
    try {
      const res = await reprocessMany.mutateAsync({
        external_quote_id: externalQuoteId || undefined,
        since: filters.since,
      });
      toast.success(
        `Reprocessamento em lote: ${res.success} sucesso, ${res.failed} falhas (${res.processed} totais).`,
      );
    } catch (e) {
      toast.error('Falha no lote.', { description: sanitizeError(e) });
    }
  }

  return (
    <>
      <PageSEO
        title="V4 Callbacks — CRM"
        description="Observabilidade e operação dos callbacks CRM → V4 (aprovação, rejeição, expiração)."
        path="/admin/v4-callbacks"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 sm:px-4 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              data-testid="page-title-v4-callbacks"
              className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              <Activity className="h-7 w-7 text-primary" />
              V4 Callbacks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Eventos recebidos do CRM Promo Champions em <code>receive-crm-callback</code>. Fonte:
              tabela <code>crm_callback_events</code> (banco canônico).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="v4-callbacks-refresh"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(data ?? [], `v4-callbacks-${Date.now()}.csv`)}
              disabled={!data?.length}
              data-testid="v4-callbacks-export-csv"
            >
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                external_quote_id
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  placeholder="UUID do orçamento"
                  value={externalQuoteId}
                  onChange={(e) => setExternalQuoteId(e.target.value)}
                  data-testid="v4-callbacks-filter-quote-id"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                event_type
              </label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType | 'all')}>
                <SelectTrigger className="h-9" data-testid="v4-callbacks-filter-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">result</label>
              <Select value={result} onValueChange={(v) => setResult(v as CallbackResult | 'all')}>
                <SelectTrigger className="h-9" data-testid="v4-callbacks-filter-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">janela</label>
              <Select
                value={String(windowHours)}
                onValueChange={(v) => setWindowHours(Number(v))}
              >
                <SelectTrigger className="h-9" data-testid="v4-callbacks-filter-window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOWS.map((w) => (
                    <SelectItem key={w.hours} value={String(w.hours)}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total', value: totals.total, cls: 'text-foreground' },
            { label: 'sent_ok', value: totals.sent_ok, cls: 'text-success' },
            { label: 'failed', value: totals.failed, cls: 'text-destructive' },
            { label: 'exhausted', value: totals.exhausted, cls: 'text-warning' },
            {
              label: 'taxa falha',
              value: `${failureRate.toFixed(1)}%`,
              cls: failureRate > 5 ? 'text-destructive' : 'text-muted-foreground',
            },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${k.cls}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume por período</CardTitle>
              <CardDescription>Empilhado por resultado</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : buckets.length === 0 ? (
                <p className="pt-16 text-center text-sm text-muted-foreground">
                  Sem eventos na janela selecionada.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={buckets}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(v) => fmtDate(v)}
                      minTickGap={40}
                      style={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} style={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => fmtDate(String(v))} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="sent_ok"
                      stackId="1"
                      stroke="hsl(var(--success))"
                      fill="hsl(var(--success))"
                      fillOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stackId="1"
                      stroke="hsl(var(--destructive))"
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="exhausted"
                      stackId="1"
                      stroke="hsl(var(--warning))"
                      fill="hsl(var(--warning))"
                      fillOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="duplicate"
                      stackId="1"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.25}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totais por resultado</CardTitle>
              <CardDescription>Comparativo direto</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'sent_ok', value: totals.sent_ok },
                    { name: 'failed', value: totals.failed },
                    { name: 'exhausted', value: totals.exhausted },
                    { name: 'duplicate', value: totals.duplicate },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" style={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} style={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Dead-letters + reprocesso */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Dead-letters ({totals.failed + totals.exhausted})</CardTitle>
              <CardDescription>
                Callbacks com <code>result ∈ {'{'}error, exhausted{'}'}</code>. Botão reprocessar
                re-executa <code>buildQuoteUpdates</code>.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleReprocessBatch}
              disabled={reprocessMany.isPending || totals.failed + totals.exhausted === 0}
              data-testid="v4-callbacks-reprocess-batch"
            >
              <RotateCw className={`mr-2 h-4 w-4 ${reprocessMany.isPending ? 'animate-spin' : ''}`} />
              Reprocessar em lote
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">
                Erro ao carregar: {(error as Error).message}
              </p>
            ) : (
              <div className="max-h-[500px] overflow-auto rounded-md border border-border/40">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left">
                    <tr>
                      <th className="p-2">created_at</th>
                      <th className="p-2">event</th>
                      <th className="p-2">quote</th>
                      <th className="p-2">result</th>
                      <th className="p-2">error</th>
                      <th className="p-2 text-right">ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data ?? [])
                      .filter((r) => r.result === 'error' || r.result === 'exhausted')
                      .map((r) => (
                        <tr key={r.id} className="border-t border-border/40">
                          <td className="p-2 font-mono">{fmtDate(r.created_at)}</td>
                          <td className="p-2">
                            <Badge variant="outline">{r.event_type}</Badge>
                          </td>
                          <td className="p-2 font-mono text-[10px]">{r.external_quote_id.slice(0, 8)}…</td>
                          <td className="p-2">
                            <ResultBadge result={r.result} />
                          </td>
                          <td className="max-w-[280px] truncate p-2 text-muted-foreground" title={r.error_message ?? ''}>
                            {r.error_message ?? '—'}
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReprocessOne(r.id)}
                              disabled={reprocess.isPending}
                              data-testid={`v4-callbacks-reprocess-${r.id}`}
                            >
                              <RotateCw className="mr-1 h-3 w-3" />
                              Reprocessar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    {(data ?? []).filter((r) => r.result === 'error' || r.result === 'exhausted').length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Nenhuma dead-letter na janela. 🎉
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
