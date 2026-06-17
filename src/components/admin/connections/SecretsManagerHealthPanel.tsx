/**
 * SecretsManagerHealthPanel
 *
 * Painel de diagnóstico read-only para a edge function `secrets-manager`,
 * exibido na zona Saúde de /admin/conexoes. Mostra:
 *
 *   - Boot status: resultado da última invocação `status` (alias leve de `list`),
 *     latência e código HTTP. Permite "Testar agora" para forçar um heartbeat.
 *   - Erro de leitura corrente: se o hook `useSecretsManager` está em estado
 *     `listError`, exibe code/message com mapeamento amigável para 401/403.
 *   - Últimas chamadas: amostra das N invocações recentes (ação, ok, ms,
 *     status, request_id) consumida do buffer client-side
 *     `secretsManagerCallMetrics`. NUNCA expõe valores de segredos.
 *
 * Princípios:
 *   - Zero-cost quando desmontado (subscribe-only).
 *   - Não inicia carga de secrets sozinho — apenas reage ao hook compartilhado.
 *   - request_id é copiável para correlação com edge logs.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  Clock,
  Copy,
  Lock,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';
import {
  getSecretsManagerSamples,
  recordSecretsManagerCall,
  subscribeSecretsManagerCalls,
  type SecretsManagerCallSample,
} from '@/lib/telemetry/secretsManagerCallMetrics';
import { useSecretsManager } from '@/hooks/admin';
import { toast } from 'sonner';

const MAX_RECENT = 8;

function describeListError(code: string, message: string): { title: string; hint: string } {
  switch (code) {
    case 'unauthenticated':
      return {
        title: 'Sessão expirada — secrets-manager retornou 401',
        hint: 'Faça login novamente. O painel só consegue listar credenciais com sessão válida.',
      };
    case 'forbidden':
    case 'permission_denied':
      return {
        title: 'Sem permissão — secrets-manager retornou 403',
        hint: 'Apenas administradores conseguem ler credenciais. Verifique o papel do usuário em user_roles.',
      };
    default:
      return {
        title: 'Falha ao ler do secrets-manager',
        hint: message || 'Erro inesperado. Veja os logs da edge function para detalhes.',
      };
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

function copyToClipboard(text: string, label = 'Copiado') {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label, { description: text }),
    () => toast.error('Não foi possível copiar'),
  );
}

export function SecretsManagerHealthPanel({ className }: { className?: string }) {
  // Reage ao mesmo hook compartilhado que alimenta a página — não dispara
  // novas chamadas sozinho (não chama list() no mount).
  const { listError } = useSecretsManager();

  // Subscribe ao buffer in-memory de amostras de chamadas (custo zero quando
  // o painel não está montado).
  const samples = useSyncExternalStore(
    subscribeSecretsManagerCalls,
    () => getSecretsManagerSamples(),
    () => getSecretsManagerSamples(),
  );

  const [pinging, setPinging] = useState(false);
  const [lastBoot, setLastBoot] = useState<{
    ok: boolean;
    durationMs: number;
    status?: number;
    error?: string;
    requestId: string;
    ts: number;
  } | null>(null);

  // Encontra a última amostra de "list" ou "status" para inferir boot health
  // mesmo sem clicar em "Testar agora".
  const inferredBoot = useMemo(() => {
    for (let i = samples.length - 1; i >= 0; i--) {
      const s = samples[i];
      if (s.action === 'list' || s.action === 'status') return s;
    }
    return null;
  }, [samples]);

  // Boot mais recente: prefere o ping manual, senão o inferido do buffer.
  const boot = useMemo<{
    ok: boolean;
    durationMs: number;
    status?: number;
    error?: string;
    requestId?: string;
    ts: number;
  } | null>(() => {
    if (lastBoot && (!inferredBoot || lastBoot.ts >= inferredBoot.ts)) return lastBoot;
    if (inferredBoot) {
      return {
        ok: inferredBoot.ok,
        durationMs: inferredBoot.durationMs,
        status: inferredBoot.status,
        error: inferredBoot.errorMessage,
        requestId: inferredBoot.requestId,
        ts: inferredBoot.ts,
      };
    }
    return null;
  }, [lastBoot, inferredBoot]);

  const ping = useCallback(async () => {
    setPinging(true);
    const requestId = newRequestId();
    const startedAt = performance.now();
    try {
      // Action `status` é alias leve de `list`. Pedimos um nome inexistente
      // para minimizar payload — só queremos validar o roundtrip.
      const { data, error } = await supabase.functions.invoke('secrets-manager', {
        body: { action: 'status', names: [] as string[] },
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
      const durationMs = Math.round(performance.now() - startedAt);
      const ctx = (error as { context?: Response } | null)?.context;
      const status = ctx?.status;
      const ok = !error && !!data && (data as { ok?: boolean }).ok !== false;
      const errorMessage =
        error?.message ??
        (data && (data as { ok?: boolean }).ok === false
          ? (data as { error?: { message?: string } }).error?.message
          : undefined);

      // Alimenta o mesmo buffer das chamadas reais para aparecer na lista.
      recordSecretsManagerCall({
        action: 'status',
        durationMs,
        ok,
        status,
        errorMessage,
        requestId,
      });

      setLastBoot({ ok, durationMs, status, error: errorMessage, requestId, ts: Date.now() });
      if (ok) toast.success('secrets-manager respondeu', { description: `${durationMs}ms` });
      else
        toast.error('secrets-manager falhou', {
          description: errorMessage ?? `HTTP ${status ?? '?'}`,
        });
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      recordSecretsManagerCall({
        action: 'status',
        durationMs,
        ok: false,
        errorMessage: message,
        requestId,
      });
      setLastBoot({ ok: false, durationMs, error: message, requestId, ts: Date.now() });
      toast.error('Falha de rede ao chamar secrets-manager', { description: message });
    } finally {
      setPinging(false);
    }
  }, []);

  // Auto-ping passivo no primeiro mount caso ainda não tenhamos NENHUMA
  // amostra (ex.: usuário entrou direto neste painel sem ter aberto a aba
  // Bancos). Mantém a UX coerente com "boot status" sem custos extras.
  useEffect(() => {
    if (!boot && !pinging) {
      // Pequeno delay para não competir com o list() inicial da página.
      const t = window.setTimeout(() => {
        ping();
      }, 1200);
      return () => window.clearTimeout(t);
    }
  }, [boot, pinging, ping]);

  const { recent, errorCount, totalCount } = useMemo(
    () => ({
      recent: samples.slice(-MAX_RECENT).reverse(),
      errorCount: samples.filter((s) => !s.ok).length,
      totalCount: samples.length,
    }),
    [samples],
  );

  const bootBadge = !boot
    ? {
        label: 'Sem heartbeat',
        cls: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
        Icon: Clock,
      }
    : boot.ok
      ? {
          label: 'Operacional',
          cls: 'border-success/40 bg-success/10 text-success',
          Icon: CheckCircle2,
        }
      : {
          label: 'Falhou',
          cls: 'border-destructive/40 bg-destructive/10 text-destructive',
          Icon: XCircle,
        };

  return (
    <Card className={className} data-testid="secrets-manager-health-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Diagnóstico do secrets-manager</CardTitle>
              <CardDescription className="text-xs">
                Boot, erros de leitura e últimas chamadas — sem expor segredos.
              </CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={ping} disabled={pinging}>
            {pinging ? (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Testando…
              </>
            ) : (
              <>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Testar boot
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Linha de status do boot */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
          <Badge variant="outline" className={`font-mono text-[10px] uppercase ${bootBadge.cls}`}>
            <bootBadge.Icon className="mr-1 h-3 w-3" />
            {bootBadge.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            {boot ? (
              <span>
                <span className="font-medium text-foreground">{boot.durationMs}ms</span>
                {typeof boot.status === 'number' && <> · HTTP {boot.status}</>}
                <> · às {formatTime(boot.ts)}</>
              </span>
            ) : (
              <span className="italic">Aguardando primeiro heartbeat…</span>
            )}
          </div>
          {boot?.requestId && (
            <button
              type="button"
              onClick={() => copyToClipboard(boot.requestId ?? '', 'request_id copiado')}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              title="Copiar request_id para correlacionar com edge logs"
            >
              <Copy className="h-3 w-3" />
              {boot.requestId.slice(0, 8)}…
            </button>
          )}
        </div>

        {/* Erro de leitura corrente (do hook compartilhado) */}
        {listError &&
          (() => {
            const { title, hint } = describeListError(listError.code, listError.message);
            return (
              <Alert variant="destructive" role="alert" aria-live="polite">
                {listError.code === 'unauthenticated' ||
                listError.code === 'forbidden' ||
                listError.code === 'permission_denied' ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                <AlertTitle className="text-sm">{title}</AlertTitle>
                <AlertDescription>
                  <p className="text-xs">{hint}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    código: {listError.code}
                  </p>
                </AlertDescription>
              </Alert>
            );
          })()}

        {/* Últimas chamadas */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Últimas chamadas{' '}
              <span className="font-mono">
                ({recent.length}/{totalCount}
                {errorCount > 0 && (
                  <span className="text-destructive">
                    {' '}
                    · {errorCount} erro{errorCount === 1 ? '' : 's'}
                  </span>
                )}
                )
              </span>
            </p>
          </div>
          {recent.length === 0 ? (
            <p className="px-1 text-xs italic text-muted-foreground">
              Nenhuma chamada registrada ainda nesta sessão.
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.map((s) => (
                <SampleRow key={s.id} sample={s} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SampleRow({ sample }: { sample: SecretsManagerCallSample }) {
  const requestId = sample.requestId;
  const tone = sample.ok
    ? 'border-success/30 bg-success/5'
    : 'border-destructive/40 bg-destructive/5';
  return (
    <li
      className={`flex items-center gap-2 rounded-md border ${tone} flex-wrap px-2 py-1.5 text-xs`}
    >
      <Badge
        variant="outline"
        className={`font-mono text-[10px] uppercase ${
          sample.ok
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-destructive/40 bg-destructive/10 text-destructive'
        }`}
      >
        {sample.ok ? 'OK' : 'ERR'}
      </Badge>
      <span className="font-mono text-[11px]">{sample.action}</span>
      {sample.target && (
        <span className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">
          {sample.target}
        </span>
      )}
      <span className="text-muted-foreground">{sample.durationMs}ms</span>
      {typeof sample.status === 'number' && (
        <span className="text-muted-foreground">HTTP {sample.status}</span>
      )}
      <span className="text-muted-foreground/80">{formatTime(sample.ts)}</span>
      {!sample.ok && sample.errorMessage && (
        <span className="max-w-[260px] truncate text-destructive" title={sample.errorMessage}>
          · {sample.errorMessage}
        </span>
      )}
      {requestId && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(requestId).then(
              () => toast.success('request_id copiado', { description: requestId }),
              () => toast.error('Não foi possível copiar'),
            );
          }}
          className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          title="Copiar request_id"
        >
          <Copy className="h-3 w-3" />
          {requestId.slice(0, 8)}…
        </button>
      )}
    </li>
  );
}
