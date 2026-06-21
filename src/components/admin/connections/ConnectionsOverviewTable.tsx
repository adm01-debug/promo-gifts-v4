import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw,
  Database,
  Briefcase,
  Workflow,
  Plug,
  Webhook,
  Loader2,
  PlayCircle,
  Clock,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { LatencyBadge } from './LatencyBadge';
import {
  applyFilters,
  useConnectionTester,
  useConnectionsOverview,
  useConnectionsOverviewFilters,
  type ConnectionType,
  type OverviewRow,
} from '@/hooks/intelligence';
import { ConnectionsOverviewFilters } from './ConnectionsOverviewFilters';
import { ConnectionTestDetailsDialog } from './ConnectionTestDetailsDialog';
import { ConnectionTimelineDrawer } from './ConnectionTimelineDrawer';
import { useConsecutiveFailures } from '@/hooks/common';
import { CONSECUTIVE_FAILURE_THRESHOLD } from '@/lib/connections-config';
import { useSecretsManager } from '@/hooks/admin';
import { ConnectionRowSourceBadge } from './ConnectionRowSourceBadge';

const TYPE_META: Record<string, { label: string; Icon: typeof Database }> = {
  supabase: { label: 'Banco', Icon: Database },
  bitrix24: { label: 'Bitrix24', Icon: Briefcase },
  n8n: { label: 'n8n', Icon: Workflow },
  mcp: { label: 'MCP', Icon: Plug },
  webhook_outbound: { label: 'Webhook', Icon: Webhook },
};

interface BulkProgress {
  total: number;
  done: number;
  ok: number;
  fail: number;
  startedAt: number;
}

function BulkTestProgressPanel({
  progress,
  elapsed,
  cancelling,
  onCancel,
}: {
  progress: BulkProgress;
  elapsed: number;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex-1 space-y-1.5">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-xs tabular-nums text-muted-foreground"
        >
          <span>
            {cancelling ? 'Cancelando...' : `Testando ${progress.done} de ${progress.total}`}
            <span className="mx-2">·</span>
            <span className="text-success">✓ {progress.ok}</span>
            <span className="mx-1.5">·</span>
            <span className="text-destructive">✗ {progress.fail}</span>
            <span className="mx-2">·</span>
            <span>⏱ {elapsed}s</span>
          </span>
          <span className="font-display text-[10px]">{pct}%</span>
        </div>
        <Progress value={pct} aria-label="Progresso dos testes em massa" className="h-1.5" />
      </div>
      <Button variant="outline" size="sm" onClick={onCancel} disabled={cancelling}>
        <X className="h-3.5 w-3.5" />
        Cancelar
      </Button>
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'agora há pouco';
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)}h`;
  return `há ${Math.round(diff / 86_400_000)}d`;
}

function rowStatus(
  r: OverviewRow,
): 'active' | 'degraded' | 'disabled' | 'error' | 'never_tested' | 'unconfigured' {
  // Persisted states (external_connections.status) take precedence
  const persisted = (r.status ?? '').toLowerCase();
  if (persisted === 'disabled' || persisted === 'inactive') return 'disabled';
  if (persisted === 'unconfigured') return 'unconfigured';
  // Configured but never tested
  if (!r.last_test_at) return 'never_tested';
  // Tested at least once → derive from last result
  if (r.last_test_ok === true) return 'active';
  if (r.last_test_ok === false) return 'error';
  return 'degraded';
}

interface ConnectionsOverviewTableProps {
  /** When this number changes, the table refetches. */
  refreshSignal?: number;
}

export function ConnectionsOverviewTable({ refreshSignal }: ConnectionsOverviewTableProps = {}) {
  const { rows, loading, refreshing, refresh, patchRow } = useConnectionsOverview(30000);
  const { secrets, list: refreshSecrets } = useSecretsManager();
  useEffect(() => {
    refreshSecrets();
  }, [refreshSecrets]);

  // External refresh trigger
  const lastSignalRef = useRef<number | undefined>(refreshSignal);
  useEffect(() => {
    if (refreshSignal === undefined) return;
    if (lastSignalRef.current === refreshSignal) return;
    lastSignalRef.current = refreshSignal;
    void refresh();
  }, [refreshSignal, refresh]);

  const { test } = useConnectionTester();
  const filterState = useConnectionsOverviewFilters();
  const { filters, activeCount, reset } = filterState;
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [bulkTesting, setBulkTesting] = useState(false);
  const [detailsRow, setDetailsRow] = useState<OverviewRow | null>(null);
  const [timelineRow, setTimelineRow] = useState<OverviewRow | null>(null);
  const { map: failuresMap } = useConsecutiveFailures(rows, 30000);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const cancelRef = useRef(false);
  const [concurrency, setConcurrency] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    const stored = window.localStorage.getItem('connections.bulk_test_concurrency');
    return Math.min(8, Math.max(1, parseInt(stored ?? '3', 10) || 3));
  });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!progress) {
      setElapsed(0);
      return;
    }
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - progress.startedAt) / 1000)),
      250,
    );
    return () => clearInterval(id);
  }, [progress]);

  const filtered = useMemo(
    () => applyFilters(rows, filters, failuresMap),
    [rows, filters, failuresMap],
  );

  function addTestingKey(k: string) {
    setTestingKeys((prev) => {
      const n = new Set(prev);
      n.add(k);
      return n;
    });
  }
  function removeTestingKey(k: string) {
    setTestingKeys((prev) => {
      const n = new Set(prev);
      n.delete(k);
      return n;
    });
  }

  async function runTest(row: OverviewRow) {
    addTestingKey(row.key);
    try {
      const res = await test(row.type as ConnectionType, {
        env_key: row.env_key ?? undefined,
        connectionId: row.id ?? undefined,
      });
      patchRow(row.key, {
        last_test_at: res.tested_at ?? new Date().toISOString(),
        last_test_ok: res.ok,
        last_test_message: res.ok ? (res.message ?? null) : (res.error ?? null),
        last_latency_ms: res.latency_ms ?? null,
      });
    } finally {
      removeTestingKey(row.key);
    }
  }

  async function toggleAutoTest(row: OverviewRow, next: boolean) {
    if (!row.id) return;
    // Optimistic update
    patchRow(row.key, { auto_test_enabled: next });
    const { error } = await supabase
      .from('external_connections')
      .update({ auto_test_enabled: next })
      .eq('id', row.id);
    if (error) {
      patchRow(row.key, { auto_test_enabled: !next });
      toast.error('Não foi possível atualizar o auto-teste', { description: sanitizeError(error) });
      return;
    }
    toast.success(next ? 'Auto-teste habilitado' : 'Auto-teste desabilitado', {
      description: next
        ? `${row.name} voltará a ser testada pelo cron`
        : `${row.name} será ignorada pelo cron de testes`,
    });
  }

  function changeConcurrency(v: string) {
    const n = Math.min(8, Math.max(1, parseInt(v, 10) || 3));
    setConcurrency(n);
    try {
      window.localStorage.setItem('connections.bulk_test_concurrency', String(n));
    } catch {
      /* noop */
    }
  }

  async function runAll() {
    const queue = [...filtered];
    const total = queue.length;
    if (total === 0) return;
    cancelRef.current = false;
    setBulkTesting(true);
    setProgress({ total, done: 0, ok: 0, fail: 0, startedAt: Date.now() });
    try {
      const c = Math.min(concurrency, total);
      const workers = Array.from({ length: c }, async () => {
        while (queue.length) {
          if (cancelRef.current) return;
          const next = queue.shift();
          if (!next) return;
          addTestingKey(next.key);
          try {
            const res = await test(next.type as ConnectionType, {
              env_key: next.env_key ?? undefined,
              connectionId: next.id ?? undefined,
              silent: true,
            });
            patchRow(next.key, {
              last_test_at: res.tested_at ?? new Date().toISOString(),
              last_test_ok: res.ok,
              last_test_message: res.ok ? (res.message ?? null) : (res.error ?? null),
              last_latency_ms: res.latency_ms ?? null,
            });
            setProgress((p) =>
              p
                ? {
                    ...p,
                    done: p.done + 1,
                    ok: p.ok + (res.ok ? 1 : 0),
                    fail: p.fail + (res.ok ? 0 : 1),
                  }
                : p,
            );
          } catch {
            setProgress((p) => (p ? { ...p, done: p.done + 1, ok: p.ok, fail: p.fail + 1 } : p));
          } finally {
            removeTestingKey(next.key);
          }
        }
      });
      await Promise.all(workers);
      setProgress((p) => {
        if (!p) return null;
        const secs = Math.max(1, Math.round((Date.now() - p.startedAt) / 1000));
        if (cancelRef.current) {
          toast.error('Testes cancelados', {
            description: `${p.done} de ${p.total} executados em ${secs}s`,
          });
        } else {
          toast.success('Testes em massa concluídos', {
            description: `${p.ok} OK · ${p.fail} falhas em ${secs}s`,
          });
        }
        return p;
      });
      await refresh();
    } finally {
      setBulkTesting(false);
      setTimeout(() => setProgress(null), 800);
      cancelRef.current = false;
    }
  }

  function cancelBulk() {
    cancelRef.current = true;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Visão geral das conexões</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Última verificação persistida de cada integração. Atualiza automaticamente a cada 30s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Atualizar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs text-muted-foreground">Paralelos:</span>
                  <Select
                    value={String(concurrency)}
                    onValueChange={changeConcurrency}
                    disabled={bulkTesting}
                  >
                    <SelectTrigger className="h-8 w-[70px]" aria-label="Limite de testes paralelos">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Quantos testes rodam ao mesmo tempo</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={runAll}
                  disabled={bulkTesting || filtered.length === 0}
                >
                  {bulkTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )}
                  Testar {activeCount > 0 ? 'filtradas' : 'todas'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="max-w-[220px] text-xs">
                  Roda os testes em paralelo até o limite escolhido. Você pode cancelar a qualquer
                  momento.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {progress && (
          <BulkTestProgressPanel
            progress={progress}
            elapsed={elapsed}
            cancelling={cancelRef.current && progress.done < progress.total}
            onCancel={cancelBulk}
          />
        )}
        <ConnectionsOverviewFilters
          filters={filters}
          toggleType={filterState.toggleType}
          setStatus={filterState.setStatus}
          setWindow={filterState.setWindow}
          removeType={filterState.removeType}
          setOnlyConsecutiveFailures={filterState.setOnlyConsecutiveFailures}
          reset={filterState.reset}
          activeCount={activeCount}
          totalCount={rows.length}
          filteredCount={filtered.length}
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0
                ? 'Nenhuma conexão corresponde aos filtros'
                : 'Nenhuma conexão cadastrada'}
            </p>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs">
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[90px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          Origem
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="max-w-[260px] text-xs">
                          De onde vêm as credenciais EXTERNAL_*: <strong>DB</strong> (banco,
                          auditável), <strong>ENV</strong> (variável de ambiente, sem rotação) ou{' '}
                          <strong>—</strong> (não configurado).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[150px]">Última verificação</TableHead>
                  <TableHead className="w-[110px]">Falhas seguidas</TableHead>
                  <TableHead className="w-[90px]">Latência</TableHead>
                  <TableHead className="w-[110px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          Auto-teste
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="max-w-[240px] text-xs">
                          Quando ligado, o cron testa essa conexão automaticamente a cada 30min.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[140px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const meta = TYPE_META[row.type] ?? { label: row.type, Icon: Plug };
                  const Icon = meta.Icon;
                  const isTesting = testingKeys.has(row.key);
                  const message = row.last_test_message;
                  const failure = failuresMap.get(row.key);
                  const failCount = failure?.count ?? 0;
                  const overThreshold = failCount > CONSECUTIVE_FAILURE_THRESHOLD;
                  return (
                    <TableRow
                      key={row.key}
                      className={cn(
                        overThreshold && 'border-l-2 border-l-destructive bg-destructive/5',
                      )}
                    >
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-[260px] truncate" title={row.name}>
                          {row.name}
                        </div>
                        {row.env_key && (
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {row.env_key}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ConnectionRowSourceBadge envKey={row.env_key ?? null} secrets={secrets} />
                      </TableCell>
                      <TableCell>
                        {isTesting ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Testando...
                          </span>
                        ) : (
                          <ConnectionStatusBadge status={rowStatus(row)} />
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatRelative(row.last_test_at)}
                      </TableCell>
                      <TableCell>
                        {failCount === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                  overThreshold
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-warning/10 text-warning',
                                )}
                                aria-label={`${failCount} falhas consecutivas`}
                              >
                                {overThreshold && <AlertTriangle className="h-3 w-3" />}
                                {failCount}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">
                                {failure?.since
                                  ? `${failCount} ${failCount === 1 ? 'falha consecutiva' : 'falhas consecutivas'} desde ${formatRelative(failure.since)}`
                                  : `${failCount} ${failCount === 1 ? 'falha consecutiva' : 'falhas consecutivas'} — nunca houve sucesso registrado`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <LatencyBadge ms={row.last_latency_ms} />
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center">
                              <Switch
                                checked={row.auto_test_enabled}
                                onCheckedChange={(v) => toggleAutoTest(row, v)}
                                disabled={!row.id}
                                aria-label={`Auto-teste ${row.auto_test_enabled ? 'ligado' : 'desligado'} para ${row.name}`}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-[240px] text-xs">
                              {row.auto_test_enabled
                                ? 'Cron testa essa conexão a cada 30min. Clique para desligar.'
                                : 'Cron está ignorando essa conexão. Clique para reativar.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        {message ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => row.last_test_at && setDetailsRow(row)}
                                className={cn(
                                  'block max-w-full truncate text-left text-xs underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80',
                                  row.last_test_ok ? 'text-muted-foreground' : 'text-destructive',
                                )}
                                aria-label="Ver detalhes do último teste"
                              >
                                {message}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="whitespace-pre-wrap break-words text-xs">{message}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {row.last_test_at && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setDetailsRow(row)}
                                  aria-label="Ver detalhes do último teste"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">Ver detalhes do último teste</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runTest(row)}
                            disabled={isTesting || bulkTesting}
                          >
                            {isTesting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PlayCircle className="h-3.5 w-3.5" />
                            )}
                            Testar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>
      {detailsRow && (
        <ConnectionTestDetailsDialog
          open={!!detailsRow}
          onOpenChange={(v) => {
            if (!v) setDetailsRow(null);
          }}
          connectionType={detailsRow.type as ConnectionType}
          connectionLabel={detailsRow.name}
          envKey={detailsRow.env_key ?? undefined}
          connectionId={detailsRow.id ?? undefined}
          onViewFullHistory={() => setTimelineRow(detailsRow)}
        />
      )}
      {timelineRow && (
        <ConnectionTimelineDrawer
          type={timelineRow.type}
          label={timelineRow.name}
          hideTrigger
          open={!!timelineRow}
          onOpenChange={(v) => {
            if (!v) setTimelineRow(null);
          }}
        />
      )}
    </Card>
  );
}
