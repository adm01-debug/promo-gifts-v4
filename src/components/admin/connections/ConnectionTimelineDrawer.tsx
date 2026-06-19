/**
 * ConnectionTimelineDrawer — Onda 12 #4
 * Drawer lateral que mostra o histórico de testes de uma conexão externa por tipo.
 * - Sparkline de latência últimos 7 dias (recharts)
 * - Tabela paginada dos últimos 50 testes
 * - Top 5 erros agrupados
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ExportButton } from './ExportButton';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { maskSensitiveText } from '@/lib/sensitive-masking';

interface TestRow {
  id: string;
  connection_id: string;
  tested_at: string;
  success: boolean;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
}

interface Props {
  /** Tipo da conexão em external_connections (supabase, bitrix24, n8n, mcp, webhook_outbound) */
  type: string;
  /** Rótulo exibido no botão / cabeçalho */
  label: string;
  /** Variant do botão trigger */
  triggerVariant?: 'outline' | 'ghost' | 'secondary' | 'default';
  /** Tamanho do botão */
  triggerSize?: 'sm' | 'default';
  /** Controle externo opcional do estado aberto (ex.: abrir a partir do modal de detalhes). */
  open?: boolean;
  /** Callback quando o estado aberto muda (apenas em modo controlado). */
  onOpenChange?: (open: boolean) => void;
  /** Quando true, omite o botão trigger (drawer só abre via prop `open`). */
  hideTrigger?: boolean;
}

export function ConnectionTimelineDrawer({
  type,
  label,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Busca conexões deste tipo
      const { data: conns } = await supabase
        .from('external_connections')
        .select('id')
        .eq('type', type);
      const ids = (conns ?? []).map((c) => c.id);
      if (ids.length === 0) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from('connection_test_history')
        .select('*')
        .in('connection_id', ids)
        .order('tested_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        if (error) {
          logger.error('[connections.timeline] failed to load history', {
            type,
            code: error.code ?? 'unknown',
            message: maskSensitiveText(error.message) ?? 'unknown',
          });
        }
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, type]);

  // Sparkline: últimos 7 dias agregados por hora (média)
  const chartData = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.tested_at).getTime() >= sevenDaysAgo);
    return recent
      .slice()
      .reverse()
      .map((r) => ({
        t: format(new Date(r.tested_at), 'dd/MM HH:mm'),
        latency: r.latency_ms ?? 0,
        success: r.success,
      }));
  }, [rows]);

  // Top 5 erros agrupados
  const topErrors = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.success && r.error_message) {
        const key = r.error_message.slice(0, 80);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const ok = rows.filter((r) => r.success).length;
    const avgLat =
      rows.filter((r) => r.latency_ms !== null).reduce((s, r) => s + (r.latency_ms ?? 0), 0) /
      Math.max(1, rows.filter((r) => r.latency_ms !== null).length);
    return {
      total,
      ok,
      rate: total > 0 ? (ok / total) * 100 : null,
      avgLat: Math.round(avgLat || 0),
    };
  }, [rows]);

  const paged = rows.slice(page * pageSize, page * pageSize + pageSize);
  const pages = Math.ceil(rows.length / pageSize);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button variant={triggerVariant} size={triggerSize}>
            <History className="mr-1 h-4 w-4" /> Histórico
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico — {label}
          </SheetTitle>
          <SheetDescription>Últimos 50 testes registrados (retenção automática).</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum teste registrado ainda. Execute "Testar conexão" para começar a gravar
              histórico.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px]">Taxa de sucesso</CardDescription>
                    <CardTitle className="text-lg">
                      {stats.rate === null ? '—' : `${stats.rate.toFixed(0)}%`}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px]">Latência média</CardDescription>
                    <CardTitle className="text-lg">{stats.avgLat}ms</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px]">Total testes</CardDescription>
                    <CardTitle className="text-lg">{stats.total}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {chartData.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Latência (últimos 7 dias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="t" tick={{ fontSize: 10 }} hide />
                          <YAxis tick={{ fontSize: 10 }} unit="ms" width={45} />
                          <Tooltip
                            contentStyle={{
                              fontSize: 11,
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 6,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="latency"
                            stroke="hsl(var(--primary))"
                            fill="url(#lat)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {topErrors.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive" /> Top erros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {topErrors.map(([msg, count]) => (
                      <div
                        key={msg}
                        className="flex items-start justify-between gap-2 rounded border border-destructive/10 bg-destructive/5 p-2 text-xs"
                      >
                        <span className="flex-1 truncate font-mono" title={msg}>
                          {msg}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {count}×
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Eventos</CardTitle>
                    <ExportButton
                      filename={`connection-history_${type}`}
                      rows={rows.map((r) => ({
                        tested_at: r.tested_at,
                        success: r.success,
                        latency_ms: r.latency_ms ?? '',
                        status_code: r.status_code ?? '',
                        error_message: r.error_message ?? '',
                      }))}
                      columns={[
                        { key: 'tested_at', header: 'tested_at' },
                        { key: 'success', header: 'success' },
                        { key: 'latency_ms', header: 'latency_ms' },
                        { key: 'status_code', header: 'status_code' },
                        { key: 'error_message', header: 'error_message' },
                      ]}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Quando</TableHead>
                        <TableHead className="w-16 text-xs">Status</TableHead>
                        <TableHead className="w-20 text-xs">Latência</TableHead>
                        <TableHead className="text-xs">Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDistanceToNow(new Date(r.tested_at), {
                              locale: ptBR,
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell>
                            {r.success ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.latency_ms !== null ? `${r.latency_ms}ms` : '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'max-w-[200px] truncate text-xs',
                              !r.success && 'text-destructive',
                            )}
                            title={r.error_message ?? ''}
                          >
                            {r.error_message ?? `HTTP ${r.status_code ?? '?'}`}
                          </TableCell>
                        </TableRow>
                      ))}
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
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
