/**
 * Card "Circuit Breaker — crm-db-bridge"
 *
 * Faz poll do endpoint `?op=breaker_status` a cada 15s e mostra:
 *   - state (CLOSED/OPEN/HALF_OPEN) com cor semântica
 *   - failures (na janela móvel) vs failureThreshold
 *   - openedAt (quando abriu) + countdown até willResetAt
 *   - configuração do breaker (window/openDuration)
 *
 * Bypass total no servidor: o endpoint funciona mesmo com circuito aberto,
 * o que é exatamente o que torna este card útil para diagnóstico em outage.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { toErrorMessage } from '@/lib/to-error-message';
import { cn } from '@/lib/utils';

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'UNKNOWN';

interface BreakerStatusResponse {
  ok: boolean;
  ts: number;
  state: BreakerState;
  failures: number;
  openedAt: number;
  willResetAt: number | null;
  breaker: {
    name: string;
    state: BreakerState;
    failures: number;
    failureThreshold: number;
    windowMs: number;
    openDurationMs: number;
    openedAt: number;
    willResetAt: number | null;
  } | null;
  all: Array<BreakerStatusResponse['breaker']>;
}

const ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/crm-db-bridge?op=breaker_status`;
const POLL_MS = 15_000;

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '—';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function stateBadge(state: BreakerState) {
  if (state === 'CLOSED') {
    return (
      <Badge className="border-success/30 bg-success/15 text-[10px] text-success">
        <ShieldCheck className="mr-1 h-3 w-3" />
        CLOSED
      </Badge>
    );
  }
  if (state === 'OPEN') {
    return (
      <Badge className="border-destructive/30 bg-destructive/15 text-[10px] text-destructive">
        <ShieldAlert className="mr-1 h-3 w-3" />
        OPEN
      </Badge>
    );
  }
  if (state === 'HALF_OPEN') {
    return (
      <Badge className="border-warning/30 bg-warning/15 text-[10px] text-warning">
        <ShieldQuestion className="mr-1 h-3 w-3" />
        HALF_OPEN
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      <ShieldQuestion className="mr-1 h-3 w-3" />
      {state}
    </Badge>
  );
}

export function BreakerStatusCard() {
  const [snap, setSnap] = useState<BreakerStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FN_URL, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BreakerStatusResponse;
      setSnap(json);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Tick local (1s) só para atualizar o countdown sem refetch.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = useMemo(() => {
    if (!snap?.willResetAt) return null;
    return Math.max(0, snap.willResetAt - now);
  }, [snap, now]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Circuit Breaker — <span className="font-mono text-sm">crm-db-bridge</span>
          {snap && stateBadge(snap.state)}
          <Badge variant="secondary" className="text-[10px]">
            poll 15s
          </Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            Erro ao consultar breaker: {error}
          </div>
        )}
        {!snap ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {loading ? 'Carregando…' : 'Sem dados.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</p>
                <p className="font-display text-2xl font-bold tabular-nums">{snap.state}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">isolate atual</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Falhas (janela)
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    snap.breaker && snap.failures >= snap.breaker.failureThreshold
                      ? 'text-destructive'
                      : snap.failures > 0
                        ? 'text-warning'
                        : '',
                  )}
                >
                  {snap.failures}
                  {snap.breaker && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {' '}
                      / {snap.breaker.failureThreshold}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {snap.breaker ? `janela ${fmtMs(snap.breaker.windowMs)}` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Aberto desde
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {snap.openedAt > 0 ? new Date(snap.openedAt).toLocaleTimeString() : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {snap.openedAt > 0 ? 'última transição p/ OPEN' : 'nunca abriu nesta vida'}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Reset em
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    countdown !== null && countdown > 0 ? 'text-warning' : '',
                  )}
                >
                  {countdown !== null ? fmtCountdown(countdown) : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {snap.willResetAt
                    ? `→ ${new Date(snap.willResetAt).toLocaleTimeString()}`
                    : 'circuito não está aberto'}
                </p>
              </div>
            </div>
            {snap.breaker && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                Config: threshold {snap.breaker.failureThreshold} falhas em{' '}
                {fmtMs(snap.breaker.windowMs)} → OPEN por {fmtMs(snap.breaker.openDurationMs)}
                {' · '}atualizado {new Date(snap.ts).toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default BreakerStatusCard;
