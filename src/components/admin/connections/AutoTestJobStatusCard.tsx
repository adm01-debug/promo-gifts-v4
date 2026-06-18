import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, XCircle, RefreshCw, Clock, Repeat2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface JobRun {
  run_started_at: string;
  run_ended_at: string;
  duration_ms: number;
  total_tested: number;
  ok_count: number;
  fail_count: number;
  retried_count: number;
  avg_latency_ms: number;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AutoTestJobStatusCard() {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_auto_test_job_status', {
        _limit: 20,
      });
      if (rpcErr) throw rpcErr;
      setRuns((data ?? []) as JobRun[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const id = setInterval(fetchRuns, 60_000);
    return () => clearInterval(id);
  }, [fetchRuns]);

  const lastRun = runs[0];
  const { ok24, fail24, successRate24, runsCount24 } = useMemo(() => {
    const last24 = runs.filter(
      (r) => Date.now() - new Date(r.run_started_at).getTime() < 86_400_000,
    );
    const t = last24.reduce((acc, r) => acc + r.total_tested, 0);
    const ok = last24.reduce((acc, r) => acc + r.ok_count, 0);
    const fail = last24.reduce((acc, r) => acc + r.fail_count, 0);
    return {
      ok24: ok,
      fail24: fail,
      successRate24: t > 0 ? Math.round((ok / t) * 100) : null,
      runsCount24: last24.length,
    };
  }, [runs]);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Job: connections-auto-test</h3>
            <p className="text-xs text-muted-foreground">
              Cron de auto-teste de conexões — últimos 7 dias
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRuns}
          disabled={loading}
          className="h-8 gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {loading && runs.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma execução do cron registrada nos últimos 7 dias.
        </p>
      ) : (
        <>
          {/* KPIs do último run */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-background/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Último run
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {lastRun ? formatRelative(lastRun.run_started_at) : '—'}
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {lastRun ? formatTime(lastRun.run_started_at) : ''}
              </div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">Duração</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {lastRun ? formatDuration(lastRun.duration_ms) : '—'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {lastRun ? `${lastRun.total_tested} conexões` : ''}
              </div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">Resultado</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold tabular-nums">
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {lastRun?.ok_count ?? 0}
                </span>
                <span className="text-muted-foreground">/</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    (lastRun?.fail_count ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {lastRun?.fail_count ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">OK / falha</div>
            </div>
            <div className="rounded-md border bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">Sucesso 24h</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {successRate24 !== null ? `${successRate24}%` : '—'}
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {ok24} OK · {fail24} falha · {runsCount24} runs
              </div>
            </div>
          </div>

          {/* Tabela de runs */}
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-12 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-3">Início</div>
              <div className="col-span-2 text-right">Duração</div>
              <div className="col-span-2 text-right">Testadas</div>
              <div className="col-span-2 text-right">OK / Falha</div>
              <div className="col-span-2 text-right">Latência</div>
              <div className="col-span-1 text-right">Retry</div>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {runs.map((r) => (
                <div
                  key={r.run_started_at}
                  className="grid grid-cols-12 items-center border-t px-3 py-2 text-sm tabular-nums hover:bg-muted/30"
                >
                  <div className="col-span-3">
                    <div className="font-medium">{formatTime(r.run_started_at)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatRelative(r.run_started_at)}
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">
                    {formatDuration(r.duration_ms)}
                  </div>
                  <div className="col-span-2 text-right">{r.total_tested}</div>
                  <div className="col-span-2 text-right">
                    <span className="text-success">{r.ok_count}</span>
                    <span className="mx-1 text-muted-foreground">/</span>
                    <span
                      className={
                        r.fail_count > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'
                      }
                    >
                      {r.fail_count}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">
                    {r.avg_latency_ms > 0 ? `${r.avg_latency_ms}ms` : '—'}
                  </div>
                  <div className="col-span-1 text-right">
                    {r.retried_count > 0 ? (
                      <Badge variant="outline" className="h-5 gap-0.5 px-1.5 text-[10px]">
                        <Repeat2 className="h-2.5 w-2.5" />
                        {r.retried_count}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
