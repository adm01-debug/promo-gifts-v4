import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, RotateCcw, Gauge, TrendingUp, Clock, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type CacheEntry = {
  name: string;
  source: 'db' | 'env' | 'none';
  has_value: boolean;
  stored_at: string;
  expires_at: string;
  ttl_remaining_ms: number;
  expired: boolean;
};

type PerName = {
  name: string;
  hits: number;
  misses: number;
  expirations: number;
  resolutions: number;
  last_source: 'db' | 'env' | 'none' | null;
  last_resolved_at: string | null;
  last_duration_ms: number | null;
  hit_ratio: number;
};

type Snapshot = {
  isolate_started_at: string;
  uptime_ms: number;
  cache: { size: number; ttl_ms: number; entries: CacheEntry[] };
  counters: {
    resolutions: number;
    hits: number;
    misses: number;
    expirations: number;
    invalidations_single: number;
    invalidations_full: number;
    hit_ratio: number;
  };
  duration_ms: { samples: number; avg: number; p50: number; p95: number; p99: number; max: number };
  per_name: PerName[];
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function ratioTone(ratio: number): 'ok' | 'warn' | 'error' {
  if (ratio >= 0.85) return 'ok';
  if (ratio >= 0.5) return 'warn';
  return 'error';
}

export function CredentialCacheMetricsPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invErr } = await supabase.functions.invoke('secrets-manager', {
      body: { action: 'cache_metrics' },
    });
    if (invErr) {
      setError(invErr.message);
    } else if (!data?.ok) {
      setError(data?.error?.message ?? 'Falha ao carregar métricas.');
    } else {
      setSnapshot(data.metrics as Snapshot);
    }
    setLoading(false);
  }, []);

  const reset = useCallback(async () => {
    const { data, error: invErr } = await supabase.functions.invoke('secrets-manager', {
      body: { action: 'reset_cache_metrics' },
    });
    if (invErr || !data?.ok) {
      toast.error('Falha ao reiniciar métricas');
      return;
    }
    toast.success('Métricas reiniciadas neste isolate');
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const ratioPct = snapshot ? Math.round(snapshot.counters.hit_ratio * 100) : 0;
  const tone = snapshot ? ratioTone(snapshot.counters.hit_ratio) : 'warn';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Activity className="h-4.5 w-4.5 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Cache da SSOT — métricas</CardTitle>
              <CardDescription className="text-xs">
                Performance do{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  resolveCredential()
                </code>{' '}
                neste isolate (TTL {snapshot ? `${Math.round(snapshot.cache.ttl_ms / 1000)}s` : '—'}
                ). Valores resetam ao reiniciar a edge function.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={loading}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Resetar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !snapshot ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <p className="text-xs text-destructive">Erro: {error}</p>
        ) : snapshot ? (
          <>
            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={<TrendingUp className="h-4 w-4" />}
                label="Hit ratio"
                value={`${ratioPct}%`}
                hint={`${snapshot.counters.hits} hits / ${snapshot.counters.misses} misses`}
                tone={tone}
                progress={ratioPct}
              />
              <Kpi
                icon={<Gauge className="h-4 w-4" />}
                label="Resoluções"
                value={String(snapshot.counters.resolutions)}
                hint={`uptime ${fmtDuration(snapshot.uptime_ms)}`}
                tone="neutral"
              />
              <Kpi
                icon={<Clock className="h-4 w-4" />}
                label="Latência p95"
                value={`${snapshot.duration_ms.p95} ms`}
                hint={`avg ${snapshot.duration_ms.avg} ms · p99 ${snapshot.duration_ms.p99} ms · max ${snapshot.duration_ms.max} ms`}
                tone={snapshot.duration_ms.p95 > 50 ? 'warn' : 'ok'}
              />
              <Kpi
                icon={<Database className="h-4 w-4" />}
                label="Entradas em cache"
                value={String(snapshot.cache.size)}
                hint={`${snapshot.counters.expirations} expirações · ${snapshot.counters.invalidations_single + snapshot.counters.invalidations_full} invalidações`}
                tone="neutral"
              />
            </div>

            {/* Per-name table */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Por credencial ({snapshot.per_name.length})
              </h4>
              {snapshot.per_name.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma resolução registrada ainda. Atue na app para popular as métricas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1.5 pr-3 font-medium">Credencial</th>
                        <th className="py-1.5 pr-3 font-medium">Origem</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Hits</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Misses</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Hit ratio</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Última (ms)</th>
                        <th className="py-1.5 text-right font-medium">Última resolução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.per_name
                        .slice()
                        .sort((a, b) => b.resolutions - a.resolutions)
                        .map((p) => {
                          const pct = Math.round(p.hit_ratio * 100);
                          const t = ratioTone(p.hit_ratio);
                          return (
                            <tr key={p.name} className="border-b align-middle last:border-0">
                              <td className="max-w-[280px] truncate py-1.5 pr-3 font-mono text-[11px]">
                                {p.name}
                              </td>
                              <td className="py-1.5 pr-3">
                                <SourceBadge source={p.last_source} />
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{p.hits}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{p.misses}</td>
                              <td className="py-1.5 pr-3 text-right">
                                <span
                                  className={
                                    t === 'ok'
                                      ? 'text-green-600'
                                      : t === 'warn'
                                        ? 'text-amber-600'
                                        : 'text-destructive'
                                  }
                                >
                                  {pct}%
                                </span>
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {p.last_duration_ms ?? '—'}
                              </td>
                              <td className="py-1.5 text-right text-muted-foreground">
                                {fmtTs(p.last_resolved_at)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cache contents */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Snapshot do cache ({snapshot.cache.size}) — TTL{' '}
                {Math.round(snapshot.cache.ttl_ms / 1000)}s
              </h4>
              {snapshot.cache.entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Cache vazio.</p>
              ) : (
                <ul className="space-y-1 font-mono text-xs">
                  {snapshot.cache.entries.map((e) => (
                    <li
                      key={e.name}
                      className="flex items-center justify-between gap-2 border-b pb-1 last:border-0"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <SourceBadge source={e.source} />
                        <span>{e.name}</span>
                        {!e.has_value && (
                          <Badge variant="outline" className="text-[9px]">
                            sem valor
                          </Badge>
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] tabular-nums',
                          e.expired ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {e.expired ? 'expirado' : `expira em ${fmtDuration(e.ttl_remaining_ms)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground">
              Isolate iniciado em {fmtTs(snapshot.isolate_started_at)} · amostras de latência:{' '}
              {snapshot.duration_ms.samples}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'ok' | 'warn' | 'error' | 'neutral';
  progress?: number;
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-green-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'error'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={toneCls}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', toneCls)}>{value}</div>
      {progress !== undefined && <Progress value={progress} className="h-1" />}
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: 'db' | 'env' | 'none' | null }) {
  if (!source) {
    return (
      <Badge variant="outline" className="text-[9px]">
        —
      </Badge>
    );
  }
  if (source === 'db') {
    return <Badge className="bg-green-600 text-[9px] hover:bg-green-600">db</Badge>;
  }
  if (source === 'env') {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-600">
        env
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-destructive/40 text-[9px] text-destructive">
      none
    </Badge>
  );
}
