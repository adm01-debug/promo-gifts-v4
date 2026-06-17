/**
 * Card "Cold vs Warm — crm-db-bridge"
 *
 * Faz poll do endpoint `?op=diag` do crm-db-bridge a cada 30s e mostra
 * métricas do isolate atual:
 *   - boot.client_build_ms      (instanciação do SupabaseClient)
 *   - boot.warmup_ms            (1ª query de warmup pós-boot)
 *   - runtime.first_request_ms  (1ª request real após o boot)
 *   - isolate.age_ms / request_count / cold_request_count
 *
 * Snapshot reseta sempre que o runtime descarta o isolate por ociosidade.
 */
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flame, RefreshCw, Snowflake, Thermometer } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { toErrorMessage } from '@/lib/to-error-message';
import { cn } from '@/lib/utils';

interface DiagSnapshot {
  ok: boolean;
  ts: number;
  warm: boolean;
  isolate: {
    booted_at: number;
    age_ms: number;
    request_count: number;
    cold_request_count: number;
  };
  boot: {
    client_build_ms: number | null;
    warmup_started_at_ms: number | null;
    warmup_ms: number | null;
    warmup_ok: boolean;
    warmup_error: string | null;
  };
  runtime: {
    first_request_started_at_ms: number | null;
    first_request_ms: number | null;
  };
}

const BASE_URL = SUPABASE_URL.replace(/\/+$/, '');
const ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
const FN_URL = BASE_URL ? `${BASE_URL}/functions/v1/crm-db-bridge?op=diag` : null;
const POLL_MS = 30_000;

function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(2)} s`;
}

function fmtAge(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

function tone(ms: number | null | undefined, warn: number, bad: number): string {
  if (ms === null || ms === undefined) return 'text-muted-foreground';
  if (ms >= bad) return 'text-destructive';
  if (ms >= warn) return 'text-warning';
  return 'text-foreground';
}

export function ColdVsWarmCrmCard() {
  const [snap, setSnap] = useState<DiagSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchDiag = useCallback(async () => {
    if (!FN_URL || !ANON_KEY) {
      setError('Configuração do Supabase ausente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FN_URL, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DiagSnapshot;
      setSnap(json);
      setLastFetched(Date.now());
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!FN_URL || !ANON_KEY) {
      setError('Configuração do Supabase ausente.');
      return;
    }

    fetchDiag();
    const id = setInterval(fetchDiag, POLL_MS);
    return () => clearInterval(id);
  }, [fetchDiag]);

  const warmBadge = snap?.warm ? (
    <Badge className="border-success/30 bg-success/15 text-[10px] text-success">
      <Flame className="mr-1 h-3 w-3" />
      warm
    </Badge>
  ) : (
    <Badge className="border-border bg-muted text-[10px] text-muted-foreground">
      <Snowflake className="mr-1 h-3 w-3" />
      cold / aquecendo
    </Badge>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Thermometer className="h-4 w-4" />
          Cold vs Warm — <span className="font-mono text-sm">crm-db-bridge</span>
          {snap && warmBadge}
          <Badge variant="secondary" className="text-[10px]">
            isolate atual · poll 30s
          </Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchDiag} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            Erro ao consultar diag: {error}
          </div>
        )}
        {!snap ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {loading ? 'Carregando snapshot…' : 'Sem dados.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  client_build_ms
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    tone(snap.boot.client_build_ms, 50, 200),
                  )}
                >
                  {fmtMs(snap.boot.client_build_ms)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">instanciação do client</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  warmup_ms
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    tone(snap.boot.warmup_ms, 1000, 3000),
                  )}
                >
                  {fmtMs(snap.boot.warmup_ms)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {snap.boot.warmup_ok
                    ? '1ª query pós-boot (TLS+schema)'
                    : snap.boot.warmup_error
                      ? `falhou: ${snap.boot.warmup_error.slice(0, 40)}…`
                      : 'aguardando…'}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  first_request_ms
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    tone(snap.runtime.first_request_ms, 800, 2500),
                  )}
                >
                  {fmtMs(snap.runtime.first_request_ms)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  1ª request real (was_cold)
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  isolate idade
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {fmtAge(snap.isolate.age_ms)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  desde {new Date(snap.isolate.booted_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  requests no isolate
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {snap.isolate.request_count}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {snap.isolate.cold_request_count} marcadas was_cold
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  warmup começou em
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {fmtMs(snap.boot.warmup_started_at_ms)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">delta desde boot</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Snapshot do isolate atual · valores resetam em cada cold start
              {lastFetched && ` · atualizado ${new Date(lastFetched).toLocaleTimeString()}`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ColdVsWarmCrmCard;
