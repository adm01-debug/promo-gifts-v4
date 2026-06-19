/**
 * InboundEventsPanel — Onda 12 #5
 * Dashboard de eventos inbound (HMAC-validated webhooks recebidos).
 * KPIs 7d, gráfico de volume por endpoint, tabela paginada com filtros e payload viewer.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { ExportButton } from './ExportButton';
import {
  Inbox,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Code2,
  Loader2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, formatDistanceToNow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Period = '24h' | '7d' | '30d';

interface EventRow {
  id: string;
  endpoint_id: string;
  event_type: string | null;
  signature_valid: boolean;
  processed: boolean;
  source_ip: string | null;
  received_at: string;
  payload: unknown;
  error: string | null;
}

interface Endpoint {
  id: string;
  name: string;
  slug: string;
  source_system: string;
}

const PERIOD_HOURS: Record<Period, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
const PERIOD_LABELS: Record<Period, string> = { '24h': '1 dia', '7d': '7 dias', '30d': '30 dias' };
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
];

export function InboundEventsPanel() {
  const [period, setPeriod] = useState<Period>('7d');
  const [endpointFilter, setEndpointFilter] = useState<string>('all');
  const [onlyInvalid, setOnlyInvalid] = useState(false);
  const [onlyUnprocessed, setOnlyUnprocessed] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const pageSize = 15;

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - PERIOD_HOURS[period] * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from('inbound_webhook_events')
      .select(
        'id, endpoint_id, event_type, signature_valid, processed, source_ip, received_at, payload, error',
      )
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(500);
    if (endpointFilter !== 'all') q = q.eq('endpoint_id', endpointFilter);
    if (onlyInvalid) q = q.eq('signature_valid', false);
    if (onlyUnprocessed) q = q.eq('processed', false);
    const [{ data: ev }, { data: ep }] = await Promise.all([
      q,
      supabase.from('inbound_webhook_endpoints').select('id, name, slug, source_system'),
    ]);
    setRows((ev ?? []) as unknown as EventRow[]);
    setEndpoints(ep ?? []);
    setPage(0);
    setLoading(false);
  }, [period, endpointFilter, onlyInvalid, onlyUnprocessed]);

  useEffect(() => {
    void load();
  }, [period, endpointFilter, onlyInvalid, onlyUnprocessed, load]);

  const epMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const invalid = rows.filter((r) => !r.signature_valid).length;
    const unprocessed = rows.filter((r) => r.signature_valid && !r.processed).length;
    return {
      total,
      invalid,
      unprocessed,
      invalidRate: total > 0 ? (invalid / total) * 100 : 0,
      unprocessedRate: total > 0 ? (unprocessed / total) * 100 : 0,
    };
  }, [rows]);

  // Volume por dia x endpoint (até 4 endpoints top)
  const chartData = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.min(30, Math.ceil(PERIOD_HOURS[period] / 24));
    const buckets: Record<string, Record<string, number>> = {};
    const now = startOfDay(new Date()).getTime();
    for (let i = days - 1; i >= 0; i--) {
      const d = format(new Date(now - i * dayMs), 'dd/MM');
      buckets[d] = {};
    }
    const epCount: Record<string, number> = {};
    for (const r of rows) {
      const ep = epMap.get(r.endpoint_id);
      const name = ep ? ep.name : 'Desconhecido';
      epCount[name] = (epCount[name] ?? 0) + 1;
      const day = format(new Date(r.received_at), 'dd/MM');
      if (!buckets[day]) buckets[day] = {};
      buckets[day][name] = (buckets[day][name] ?? 0) + 1;
    }
    const topEps = Object.entries(epCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([n]) => n);
    const data = Object.entries(buckets).map(([day, counts]) => {
      const row: Record<string, string | number> = { day };
      for (const n of topEps) row[n] = counts[n] ?? 0;
      return row;
    });
    return { data, topEps };
  }, [rows, epMap, period]);

  const paged = rows.slice(page * pageSize, page * pageSize + pageSize);
  const pages = Math.ceil(rows.length / pageSize);

  const invalidTone =
    kpis.invalidRate > 15 ? 'destructive' : kpis.invalidRate > 5 ? 'warning' : 'success';
  const tone = (t: string) =>
    ({
      success: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    })[t] ?? '';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-primary" /> Eventos recebidos
              </CardTitle>
              <CardDescription>
                Webhooks de entrada com validação HMAC nos últimos {PERIOD_LABELS[period]}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="7d">7 dias</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select value={endpointFilter} onValueChange={setEndpointFilter}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Endpoint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos endpoints</SelectItem>
                  {endpoints.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={onlyInvalid ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setOnlyInvalid((v) => !v)}
              >
                <ShieldAlert className="mr-1 h-3 w-3" /> HMAC inválido
              </Button>
              <Button
                size="sm"
                variant={onlyUnprocessed ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setOnlyUnprocessed((v) => !v)}
              >
                Não processados
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={load}
                aria-label="Recarregar"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-[10px]">
                  total
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold">{kpis.total}</p>
              <p className="text-[11px] text-muted-foreground">eventos no período</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <ShieldAlert
                  className={cn(
                    'h-4 w-4',
                    invalidTone === 'success'
                      ? 'text-success'
                      : invalidTone === 'warning'
                        ? 'text-warning'
                        : 'text-destructive',
                  )}
                />
                <Badge variant="outline" className={cn('text-[10px]', tone(invalidTone))}>
                  {invalidTone === 'success'
                    ? 'OK'
                    : invalidTone === 'warning'
                      ? 'Atenção'
                      : 'Crítico'}
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold">{kpis.invalidRate.toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground">{kpis.invalid} HMAC inválidos</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <AlertTriangle
                  className={cn(
                    'h-4 w-4',
                    kpis.unprocessed > 0 ? 'text-warning' : 'text-muted-foreground',
                  )}
                />
                <Badge variant="outline" className="text-[10px]">
                  {kpis.unprocessedRate.toFixed(0)}%
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold">{kpis.unprocessed}</p>
              <p className="text-[11px] text-muted-foreground">não processados</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.data.length > 0 && chartData.topEps.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartData.topEps.map((n, i) => (
                    <Bar
                      key={n}
                      dataKey={n}
                      stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Últimos eventos</CardTitle>
            <ExportButton
              filename={`inbound-events_${period}`}
              rows={rows.map((r) => ({
                received_at: r.received_at,
                endpoint: epMap.get(r.endpoint_id)?.name ?? r.endpoint_id,
                event_type: r.event_type ?? '',
                signature_valid: r.signature_valid,
                processed: r.processed,
                source_ip: r.source_ip ?? '',
                error: r.error ?? '',
              }))}
              columns={[
                { key: 'received_at', header: 'received_at' },
                { key: 'endpoint', header: 'endpoint' },
                { key: 'event_type', header: 'event_type' },
                { key: 'signature_valid', header: 'signature_valid' },
                { key: 'processed', header: 'processed' },
                { key: 'source_ip', header: 'source_ip' },
                { key: 'error', header: 'error' },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum evento no filtro atual.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Quando</TableHead>
                    <TableHead className="text-xs">Endpoint</TableHead>
                    <TableHead className="text-xs">Evento</TableHead>
                    <TableHead className="w-20 text-xs">HMAC</TableHead>
                    <TableHead className="w-20 text-xs">Proc.</TableHead>
                    <TableHead className="text-xs">IP</TableHead>
                    <TableHead className="w-20 text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => {
                    const ep = epMap.get(r.endpoint_id);
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(r)}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDistanceToNow(new Date(r.received_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-xs">{ep?.name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.event_type ?? '—'}</TableCell>
                        <TableCell>
                          {r.signature_valid ? (
                            <ShieldCheck className="h-4 w-4 text-success" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              r.processed
                                ? 'border-success/20 bg-success/10 text-success'
                                : 'bg-muted',
                            )}
                          >
                            {r.processed ? 'OK' : '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.source_ip ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
                            <Code2 className="mr-1 h-3 w-3" /> JSON
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page + 1} / {pages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= pages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" /> Payload do evento
            </SheetTitle>
            <SheetDescription>
              {selected && (
                <span className="space-x-2">
                  <span>{epMap.get(selected.endpoint_id)?.name ?? '—'}</span>
                  <span>·</span>
                  <span className="font-mono">{selected.event_type ?? '(sem tipo)'}</span>
                  <span>·</span>
                  <span>{format(new Date(selected.received_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              {!selected.signature_valid && (
                <div className="flex items-center gap-2 rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                  <ShieldAlert className="h-4 w-4" /> Assinatura HMAC inválida — payload não
                  confiável.
                </div>
              )}
              {selected.error && (
                <div className="rounded border border-warning/20 bg-warning/10 p-2 text-xs text-warning">
                  <strong>Erro:</strong> {selected.error}
                </div>
              )}
              <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 font-mono text-[11px]">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
