import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Copy,
  Terminal,
  Clock,
  User,
  Bot,
  Webhook as WebhookIcon,
  History,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useConnectionTestDetails,
  type TestDetails,
  type ConnectionType,
  type ErrorKind,
} from '@/hooks/intelligence';
import { getErrorCopy, getKindBadgeClass, getKindLabel } from '@/lib/connection-error-copy';
import { maskSensitiveText } from '@/lib/sensitive-masking';

/** Estado pré-computado de detalhes (saída de `useConnectionTestDetails`). */
export interface ConnectionTestDetailsState {
  details: TestDetails | null;
  loading: boolean;
  error?: string | null;
  refetch?: () => Promise<unknown>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionType?: ConnectionType;
  connectionLabel?: string;
  envKey?: 'crm' | 'promobrind';
  connectionId?: string;
  /** Quando presente, abre os detalhes deste registro específico do histórico. */
  historyId?: string;
  /** Callback opcional: quando provido, mostra o botão "Ver histórico completo" no header. */
  onViewFullHistory?: () => void;
  /**
   * Estado já carregado por um hook externo. Quando provido, o diálogo usa
   * estes dados em vez de buscar internamente (evita dupla requisição).
   */
  state?: ConnectionTestDetailsState;
}

const TRIGGER_META: Record<TestDetails['triggered_by'], { label: string; Icon: typeof User }> = {
  manual: { label: 'Manual', Icon: User },
  cron: { label: 'Agendado', Icon: Bot },
  webhook: { label: 'Webhook', Icon: WebhookIcon },
};

/**
 * Mascaramento defensivo client-side (servidor já mascara).
 * Delegamos para `maskSensitiveText` (SSOT em `@/lib/sensitive-masking`),
 * que aplica largura/caracteres uniformes e cobre URL, anon key, service
 * role e demais padrões sensíveis — evitando que qualquer pedaço apareça
 * em previews de resposta (incl. listas de produtos retornadas pela API).
 */
function defensiveMask(text: string | null): string | null {
  return maskSensitiveText(text);
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)}h`;
  return `há ${Math.round(diff / 86_400_000)}d`;
}

function statusClass(status: number | null): string {
  if (status === null) return 'bg-muted text-muted-foreground border-muted-foreground/30';
  if (status >= 200 && status < 300)
    return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
  if (status >= 400) return 'bg-destructive/10 text-destructive border-destructive/30';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
}

function bytesOf(s: string | null | undefined): string {
  if (!s) return '0 B';
  const n = new Blob([s]).size;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const PREVIEW_LIMIT = 8 * 1024;

function buildCurl(d: TestDetails): string {
  const method = (d.request.method ?? 'GET').toUpperCase();
  const url = d.request.url ?? '';
  const parts: string[] = [`curl -X ${method} '${url}'`];
  const headers = d.response.headers ?? {};
  // Reconstrói apenas headers seguros (servidor já mascarou os sensíveis)
  for (const [k, v] of Object.entries(headers)) {
    if (v === '••••') continue;
    parts.push(`  -H '${k}: ${v}'`);
  }
  return parts.join(' \\\n');
}

interface TimingSegment {
  label: string;
  ms: number;
  color: string;
}

function timingSegments(t: TestDetails['timing']): TimingSegment[] {
  const segs: TimingSegment[] = [];
  if (t.dns_ms !== null) segs.push({ label: 'DNS', ms: t.dns_ms, color: 'bg-purple-500' });
  if (t.tcp_ms !== null) segs.push({ label: 'TCP', ms: t.tcp_ms, color: 'bg-blue-500' });
  if (t.tls_ms !== null) segs.push({ label: 'TLS', ms: t.tls_ms, color: 'bg-cyan-500' });
  if (t.ttfb_ms !== null) segs.push({ label: 'TTFB', ms: t.ttfb_ms, color: 'bg-amber-500' });
  if (t.download_ms !== null)
    segs.push({ label: 'Download', ms: t.download_ms, color: 'bg-green-500' });
  return segs;
}

export function ConnectionTestDetailsDialog({
  open,
  onOpenChange,
  connectionType,
  connectionLabel,
  envKey,
  connectionId,
  historyId,
  onViewFullHistory,
  state,
}: Props) {
  const internal = useConnectionTestDetails({
    open: open && !state,
    type: connectionType ?? 'n8n',
    envKey,
    connectionId,
    historyId,
  });
  const details = state ? state.details : internal.details;
  const loading = state ? state.loading : internal.loading;

  const [tab, setTab] = useState<'http' | 'resposta' | 'resumo' | 'timing'>('resumo');
  const [bodyExpanded, setBodyExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setTab('resumo');
      setBodyExpanded(false);
    }
  }, [open]);

  const maskedBody = useMemo(
    () => defensiveMask(details?.response.body ?? null),
    [details?.response.body],
  );
  const maskedUrl = useMemo(
    () => defensiveMask(details?.request.url ?? null),
    [details?.request.url],
  );

  const copyBody = useCallback(() => {
    if (!maskedBody) return;
    navigator.clipboard.writeText(maskedBody);
    toast.success('Resposta copiada');
  }, [maskedBody]);

  const copyCurl = useCallback(() => {
    if (!details) return;
    navigator.clipboard.writeText(buildCurl(details));
    toast.success('cURL copiado');
  }, [details]);

  // Atalho C copia payload quando aba "resposta" ativa
  useEffect(() => {
    if (!open || tab !== 'resposta') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) copyBody();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, tab, copyBody]);

  const segs = details ? timingSegments(details.timing) : [];
  const segsTotal = segs.reduce((acc, s) => acc + s.ms, 0);
  const totalLatency = details?.timing.latency_ms ?? null;

  const TriggerIcon = details ? TRIGGER_META[details.triggered_by].Icon : User;
  const triggerLabel = details ? TRIGGER_META[details.triggered_by].label : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-display">
            {details?.ok === true ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : details?.ok === false ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            Detalhes do último teste
            {connectionLabel && (
              <Badge variant="outline" className="ml-2">
                {connectionLabel}
              </Badge>
            )}
            {onViewFullHistory && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 gap-1.5 px-2 text-xs font-normal"
                onClick={() => {
                  onOpenChange(false);
                  // Aguarda o fade-out do dialog antes de abrir o drawer (evita scroll-lock conflict)
                  setTimeout(() => onViewFullHistory(), 180);
                }}
                title="Fechar este modal e abrir o histórico completo desta conexão"
              >
                <History className="h-3.5 w-3.5" />
                Ver histórico completo
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !details ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum teste registrado para esta conexão ainda.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="http">HTTP</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
              <TabsTrigger value="resposta">Resposta</TabsTrigger>
            </TabsList>

            {/* RESUMO */}
            <TabsContent value="resumo" className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {details.ok ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-700 dark:text-green-400">OK</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">Falha</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Latência total</div>
                  <div className="mt-0.5 font-mono">
                    {totalLatency !== null ? `${totalLatency}ms` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quando</div>
                  <div className="mt-0.5" title={details.tested_at}>
                    {formatAbsolute(details.tested_at)}
                    <span className="ml-1 text-muted-foreground">
                      ({formatRelative(details.tested_at)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Disparado por</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{triggerLabel}</span>
                    {details.triggered_by_user_email && (
                      <span className="text-xs text-muted-foreground">
                        · {details.triggered_by_user_email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!details.ok &&
                (() => {
                  const copy = getErrorCopy(
                    (details.error?.kind ?? null) as ErrorKind | null,
                    details.response.status,
                    details.error?.message,
                    details.error?.timeout_ms ?? null,
                  );
                  const ErrIcon = copy.icon;
                  const techMsg = details.error?.message?.trim();
                  const timeoutMs = details.error?.timeout_ms ?? null;
                  return (
                    <div
                      role="alert"
                      className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <ErrIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold leading-tight text-destructive">
                            {copy.title}
                          </h3>
                          <p className="mt-1 text-xs leading-snug text-destructive/80">
                            {copy.hint}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {details.error?.kind && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'inline-flex h-5 items-center gap-1 px-1.5 text-[10px] font-medium',
                              getKindBadgeClass(copy.tone),
                            )}
                            title={`Tipo de falha: ${copy.title}`}
                          >
                            <ErrIcon className="h-3 w-3" aria-hidden />
                            {getKindLabel(copy.tone)}
                          </Badge>
                        )}
                        {details.response.status !== null && (
                          <Badge variant="outline" className="h-5 font-mono text-[10px]">
                            HTTP {details.response.status}
                          </Badge>
                        )}
                        {details.error?.kind === 'timeout' && timeoutMs !== null && (
                          <Badge variant="outline" className="h-5 font-mono text-[10px]">
                            timeout: {timeoutMs}ms
                          </Badge>
                        )}
                      </div>
                      {techMsg && (
                        <details className="pl-6 text-xs">
                          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                            Mensagem técnica
                          </summary>
                          <pre className="mt-1.5 whitespace-pre-wrap break-words rounded border bg-muted/50 p-2 font-mono text-[11px]">
                            {techMsg}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })()}
            </TabsContent>

            {/* HTTP */}
            <TabsContent value="http" className="space-y-3 text-sm">
              <div className="grid grid-cols-[80px_1fr] items-baseline gap-2">
                <div className="text-xs text-muted-foreground">Método</div>
                <Badge variant="outline" className="w-fit font-mono">
                  {details.request.method ?? '—'}
                </Badge>
                <div className="text-xs text-muted-foreground">URL</div>
                <code className="break-all rounded bg-muted px-1.5 py-1 text-xs">
                  {maskedUrl ?? '—'}
                </code>
                <div className="text-xs text-muted-foreground">Status</div>
                <span
                  className={cn(
                    'inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 font-mono text-xs',
                    statusClass(details.response.status),
                  )}
                >
                  {details.response.status ?? '— (network error)'}
                </span>
                <div className="text-xs text-muted-foreground">Content-Type</div>
                <span className="font-mono text-xs">
                  {details.response.headers?.['content-type'] ??
                    details.response.headers?.['Content-Type'] ??
                    '—'}
                </span>
                <div className="text-xs text-muted-foreground">Tamanho</div>
                <span className="font-mono text-xs">{bytesOf(details.response.body)}</span>
              </div>
              {details.response.headers && Object.keys(details.response.headers).length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Headers</div>
                  <pre className="max-h-[180px] overflow-auto rounded-md border bg-muted/50 p-2 font-mono text-[11px]">
                    {Object.entries(details.response.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </pre>
                </div>
              )}
            </TabsContent>

            {/* TIMING */}
            <TabsContent value="timing" className="space-y-3">
              {segs.length === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm">Latência total</span>
                    <span className="font-mono text-sm">
                      {totalLatency !== null ? `${totalLatency}ms` : '—'}
                    </span>
                  </div>
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Breakdown indisponível para este tipo de conexão. Apenas a latência total é
                    coletada.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {segs.map((s) => (
                      <div
                        key={s.label}
                        className={cn('h-full', s.color)}
                        style={{ width: `${segsTotal > 0 ? (s.ms / segsTotal) * 100 : 0}%` }}
                        title={`${s.label}: ${s.ms}ms`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {segs.map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', s.color)} />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="ml-auto font-mono">{s.ms}ms</span>
                      </div>
                    ))}
                    <div className="col-span-2 mt-1 flex items-center gap-2 border-t pt-2">
                      <span className="text-muted-foreground">Total</span>
                      <span className="ml-auto font-mono font-medium">
                        {totalLatency ?? segsTotal}ms
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* RESPOSTA */}
            <TabsContent value="resposta" className="space-y-2">
              {!maskedBody ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Resposta não capturada para este teste.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {bytesOf(maskedBody)}
                      {details.response.truncated && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          · truncado em 16KB no servidor
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={copyBody} title="Copiar (C)">
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={copyCurl} title="Copiar como cURL">
                        <Terminal className="h-3.5 w-3.5" /> cURL
                      </Button>
                    </div>
                  </div>
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-3 font-mono text-[11px]">
                    {bodyExpanded || maskedBody.length <= PREVIEW_LIMIT
                      ? maskedBody
                      : maskedBody.slice(0, PREVIEW_LIMIT)}
                  </pre>
                  {!bodyExpanded && maskedBody.length > PREVIEW_LIMIT && (
                    <Button variant="outline" size="sm" onClick={() => setBodyExpanded(true)}>
                      Expandir ({bytesOf(maskedBody)})
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
