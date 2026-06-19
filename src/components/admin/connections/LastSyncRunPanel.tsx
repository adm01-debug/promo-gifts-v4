import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  User as UserIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { rpcAdminSyncExternalConnections } from '@/integrations/supabase/gold';
import { toast } from 'sonner';

type SyncLogRow = {
  id: string;
  ran_at: string;
  status: string;
  trigger_op: string | null;
  triggered_by_secret_name: string | null;
  triggered_by_user_id: string | null;
  processed: number;
  created_count: number;
  updated_count: number;
  duration_ms: number | null;
  error_message: string | null;
  details: unknown;
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'agora';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function LastSyncRunPanel() {
  const [last, setLast] = useState<SyncLogRow | null | undefined>(undefined); // undefined = loading, null = nenhum
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('external_connections_sync_log')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(1);
    if (fetchError) {
      setError(fetchError.message);
      setLast(null);
      return;
    }
    setLast(((data ?? [])[0] as unknown as SyncLogRow | undefined) ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runManual = useCallback(async () => {
    setRunning(true);
    // Wrapper admin-gated: a função original é SECURITY DEFINER sem checagem de
    // chamador e teve EXECUTE revogado de authenticated no hardening.
    const { error: syncError } = await rpcAdminSyncExternalConnections();
    if (syncError) {
      toast.error('Falha ao executar sincronização');
    } else {
      toast.success('Sync executado');
    }
    await load();
    setRunning(false);
  }, [load]);

  const loading = last === undefined;
  const ok = last?.status === 'ok';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Última execução do sync</CardTitle>
              <CardDescription>
                Trigger{' '}
                <code className="rounded bg-muted px-1 text-[10px]">
                  sync_external_connections_from_credentials
                </code>{' '}
                — última corrida registrada em{' '}
                <code className="rounded bg-muted px-1 text-[10px]">
                  external_connections_sync_log
                </code>
                .
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={runManual} disabled={running}>
              <Zap className={`mr-2 h-4 w-4 ${running ? 'animate-pulse' : ''}`} />
              {running ? 'Executando…' : 'Rodar agora'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Erro ao ler logs: <code className="text-xs">{error}</code>
          </div>
        ) : !last ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            Nenhuma execução registrada ainda. Use <strong>Rodar agora</strong> ou edite uma
            credencial <code className="text-[11px]">EXTERNAL_*</code> para disparar o trigger.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header com status e timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                {ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <div className="text-sm font-semibold">
                    {new Date(last.ran_at).toLocaleString('pt-BR')}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({formatRelative(last.ran_at)})
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    status={last.status}
                    {last.trigger_op ? ` • op=${last.trigger_op}` : ''}
                    {typeof last.duration_ms === 'number' ? ` • ${last.duration_ms}ms` : ''}
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  ok
                    ? 'border-green-500/40 bg-green-500/5 text-green-700'
                    : 'border-amber-500/40 bg-amber-500/5 text-amber-700'
                }
              >
                {ok ? 'ok' : last.status}
              </Badge>
            </div>

            {/* KPIs */}
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Processadas
                </div>
                <div className="text-2xl font-bold tabular-nums">{last.processed}</div>
                <div className="text-[10px] text-muted-foreground">env_keys avaliadas</div>
              </div>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-green-700">
                  <Plus className="h-3 w-3" /> Criadas
                </div>
                <div className="text-2xl font-bold tabular-nums text-green-700">
                  {last.created_count}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  novas linhas em external_connections
                </div>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-blue-700">
                  <Pencil className="h-3 w-3" /> Atualizadas
                </div>
                <div className="text-2xl font-bold tabular-nums text-blue-700">
                  {last.updated_count}
                </div>
                <div className="text-[10px] text-muted-foreground">linhas existentes alteradas</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Duração
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {typeof last.duration_ms === 'number' ? `${last.duration_ms}` : '—'}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
                </div>
                <div className="text-[10px] text-muted-foreground">tempo total da função</div>
              </div>
            </div>

            {/* Disparador */}
            <div className="space-y-1 rounded-lg border p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Disparo
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {last.trigger_op ?? '—'}
                </Badge>
                {last.triggered_by_secret_name ? (
                  <span className="font-mono text-[11px]">
                    secret ={' '}
                    <code className="rounded bg-muted px-1">{last.triggered_by_secret_name}</code>
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">
                    sem secret associado (manual ou cron)
                  </span>
                )}
                {last.triggered_by_user_id && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserIcon className="h-3 w-3" />
                    <code className="text-[10px]">{last.triggered_by_user_id.slice(0, 8)}…</code>
                  </span>
                )}
              </div>
            </div>

            {/* Erro, se houver */}
            {last.error_message && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <div className="mb-1 font-semibold">Erro registrado</div>
                <code className="whitespace-pre-wrap break-words text-[11px]">
                  {last.error_message}
                </code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
