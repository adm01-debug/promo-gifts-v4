import { useEffect, useState, useCallback } from 'react';
import {
  XCircle,
  Copy,
  History as HistoryIcon,
  ChevronDown,
  Lightbulb,
  Clock,
  WifiOff,
  Globe,
  KeyRound,
  ServerCrash,
  Settings2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LastTestInfo } from './LastTestLine';
import type { ErrorKind } from '@/hooks/intelligence';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionType: string;
  connectionLabel: string;
  summary: LastTestInfo | null;
  envKey?: 'promobrind' | 'crm';
  onOpenTimeline?: () => void;
}

interface DetailRow {
  id: string;
  tested_at: string;
  success: boolean;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  error_kind: ErrorKind | null;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)}h`;
  return `há ${Math.round(diff / 86_400_000)}d`;
}

const SUGGESTIONS: Record<ErrorKind, string> = {
  timeout:
    'Aumente o timeout, verifique se o serviço está sobrecarregado ou se há latência de rede excessiva.',
  network:
    'O serviço pode estar offline, fora do ar ou bloqueando o IP da função. Tente novamente em alguns minutos.',
  dns: 'DNS não resolvido — verifique se a URL está correta e o domínio existe.',
  auth: 'Verifique se as credenciais estão corretas, não expiraram e têm as permissões necessárias.',
  http: 'Serviço externo retornou erro — consulte os logs do destino para entender a causa.',
  config: 'Configure as credenciais necessárias antes de testar a conexão.',
  unknown: 'Erro não categorizado — consulte os detalhes técnicos abaixo.',
};

const KIND_META: Record<ErrorKind, { label: string; Icon: typeof Clock; className: string }> = {
  timeout: {
    label: 'Timeout',
    Icon: Clock,
    className: 'border-warning/40 bg-warning/10 text-warning',
  },
  network: {
    label: 'Rede',
    Icon: WifiOff,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  dns: {
    label: 'DNS',
    Icon: Globe,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  auth: {
    label: 'Auth',
    Icon: KeyRound,
    className: 'border-warning/40 bg-warning/10 text-warning',
  },
  http: {
    label: 'HTTP',
    Icon: ServerCrash,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  config: {
    label: 'Config',
    Icon: Settings2,
    className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  },
  unknown: {
    label: 'Desconhecido',
    Icon: AlertCircle,
    className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  },
};

/** Legacy regex-based fallback for rows persisted before error_kind existed. */
function suggestionFromMessage(
  message: string | null | undefined,
  status: number | null | undefined,
): string | null {
  const m = (message ?? '').toLowerCase();
  if (status === 401 || status === 403) return SUGGESTIONS.auth;
  if (status === 404) return 'Verifique se a URL base está correta.';
  if (status && status >= 500) return SUGGESTIONS.http;
  if (m.includes('etimedout') || m.includes('timeout') || m.includes('tempo esgotado'))
    return SUGGESTIONS.timeout;
  if (m.includes('econnrefused') || m.includes('network') || m.includes('rede'))
    return SUGGESTIONS.network;
  if (m.includes('dns') || m.includes('getaddrinfo')) return SUGGESTIONS.dns;
  if (m.includes('jwt') || m.includes('token'))
    return 'Token JWT possivelmente malformado — re-salve o secret.';
  return null;
}

export function ConnectionErrorDetailsDialog({
  open,
  onOpenChange,
  connectionType,
  connectionLabel,
  summary,
  envKey,
  onOpenTimeline,
}: Props) {
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase.from('external_connections').select('id').eq('type', connectionType);
        if (envKey) q = q.eq('env_key', envKey);
        const { data: conns } = await q;
        let ids = (conns ?? []).map((c) => c.id);
        if (ids.length === 0 && envKey) {
          const { data: fallbackConns } = await supabase
            .from('external_connections')
            .select('id')
            .eq('type', connectionType);
          ids = (fallbackConns ?? []).map((c) => c.id);
        }
        if (ids.length === 0) {
          if (!cancelled) setDetail(null);
          return;
        }
        const { data } = await supabase
          .from('connection_test_history')
          .select('id,tested_at,success,latency_ms,status_code,error_message,error_kind')
          .in('connection_id', ids)
          .eq('success', false)
          .order('tested_at', { ascending: false })
          .limit(1);
        if (!cancelled) setDetail(((data ?? [])[0] as DetailRow) ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, connectionType, envKey]);

  const status = detail?.status_code ?? summary?.status ?? null;
  const message = detail?.error_message ?? summary?.message ?? null;
  const latency = detail?.latency_ms ?? summary?.latency_ms ?? null;
  const testedAt = detail?.tested_at ?? summary?.tested_at ?? null;
  const errorKind: ErrorKind | null = detail?.error_kind ?? summary?.error_kind ?? null;
  const suggestion = errorKind ? SUGGESTIONS[errorKind] : suggestionFromMessage(message, status);
  const kindMeta = errorKind ? KIND_META[errorKind] : null;

  const copyDetails = useCallback(() => {
    const payload = {
      connection: connectionLabel,
      type: connectionType,
      env_key: envKey ?? null,
      tested_at: testedAt,
      latency_ms: latency,
      status_code: status,
      error_kind: errorKind,
      message,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Detalhes copiados');
  }, [connectionLabel, connectionType, envKey, testedAt, latency, status, errorKind, message]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        copyDetails();
      } else if (e.key.toLowerCase() === 'h' && onOpenTimeline) {
        onOpenTimeline();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, copyDetails, onOpenTimeline]);

  const statusVariant: 'destructive' | 'outline' =
    status && status >= 400 ? 'destructive' : 'outline';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Detalhes da falha
            <Badge variant="outline" className="ml-2">
              {connectionLabel}
            </Badge>
            {kindMeta && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
                  kindMeta.className,
                )}
                title={`Categoria do erro: ${kindMeta.label}`}
              >
                <kindMeta.Icon className="h-3 w-3" />
                {kindMeta.label}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Quando</div>
              <div title={testedAt ?? ''}>{formatRelative(testedAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Latência</div>
              <div className="font-mono">{latency !== null ? `${latency}ms` : '— (timeout)'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">HTTP Status</div>
              <div>
                {status !== null ? (
                  <Badge variant={statusVariant} className="font-mono">
                    {status}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">— (network error)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tipo</div>
              <Badge variant="outline" className="font-mono">
                {connectionType}
              </Badge>
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Mensagem</div>
            <div className="max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-mono text-xs">
              {loading ? 'Carregando…' : message || '(sem mensagem)'}
            </div>
          </div>

          {/* Detalhes técnicos collapsible */}
          {detail && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown className="h-3.5 w-3.5" /> Detalhes técnicos
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  {JSON.stringify(
                    {
                      id: detail.id,
                      tested_at: detail.tested_at,
                      success: detail.success,
                      latency_ms: detail.latency_ms,
                      status_code: detail.status_code,
                      error_kind: detail.error_kind,
                      error_message: detail.error_message,
                    },
                    null,
                    2,
                  )}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Sugestão */}
          {suggestion && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs',
              )}
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{suggestion}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={copyDetails} title="Copiar (C)">
            <Copy className="h-3.5 w-3.5" /> Copiar detalhes
          </Button>
          {onOpenTimeline && (
            <Button variant="outline" size="sm" onClick={onOpenTimeline} title="Histórico (H)">
              <HistoryIcon className="h-3.5 w-3.5" /> Ver histórico completo
            </Button>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
