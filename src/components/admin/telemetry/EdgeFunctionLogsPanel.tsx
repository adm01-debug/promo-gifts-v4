import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Filter,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getBridgeSamples,
  subscribeBridgeCalls,
  clearBridgeSamples,
  type BridgeCallSample,
} from '@/lib/telemetry/bridgeCallMetrics';
import {
  getSecretsManagerSamples,
  subscribeSecretsManagerCalls,
  clearSecretsManagerSamples,
  type SecretsManagerCallSample,
} from '@/lib/telemetry/secretsManagerCallMetrics';
import { shortRequestId } from '@/lib/telemetry/requestId';

/**
 * EdgeFunctionLogsPanel — painel de logs ao vivo das edge functions críticas:
 *  - external-db-bridge / crm-db-bridge (já instrumentadas)
 *  - secrets-manager
 *
 * Cada linha exibe: timestamp, função, ação/op, status, latência, requestId
 * (curto). Expandir mostra detalhes completos para correlacionar com os logs
 * do servidor (filtre por requestId nos edge logs).
 *
 * Custo zero quando o painel não está aberto: as funções de coleta só
 * notificam quando há subscribers.
 */

type UnifiedSample = {
  uid: string;
  ts: number;
  source: 'external-db-bridge' | 'crm-db-bridge' | 'secrets-manager';
  op: string;
  target?: string;
  durationMs: number;
  ok: boolean;
  status?: number;
  errorMessage?: string;
  errorCode?: string;
  requestId?: string;
  serverRequestId?: string;
  /** Original para detalhes adicionais (req/resp bytes etc.) */
  raw: BridgeCallSample | SecretsManagerCallSample;
};

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Todas as funções' },
  { value: 'external-db-bridge', label: 'external-db-bridge' },
  { value: 'crm-db-bridge', label: 'crm-db-bridge' },
  { value: 'secrets-manager', label: 'secrets-manager' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'Sucesso' },
  { value: 'error', label: 'Erro' },
] as const;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtBytes(n: number | undefined): string {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error('Falha ao copiar');
  }
}

export function EdgeFunctionLogsPanel() {
  const bridgeSamples = useSyncExternalStore(
    subscribeBridgeCalls,
    () => getBridgeSamples(),
    () => getBridgeSamples(),
  );
  const secretsSamples = useSyncExternalStore(
    subscribeSecretsManagerCalls,
    () => getSecretsManagerSamples(),
    () => getSecretsManagerSamples(),
  );

  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const unified = useMemo<UnifiedSample[]>(() => {
    const fromBridge: UnifiedSample[] = bridgeSamples.map((s) => ({
      uid: `b-${s.id}`,
      ts: s.ts,
      source: s.bridge,
      op: s.op,
      target: s.target,
      durationMs: s.durationMs,
      ok: s.ok,
      status: s.status,
      errorMessage: s.errorMessage,
      requestId: s.requestId,
      serverRequestId: s.serverRequestId,
      raw: s,
    }));
    const fromSecrets: UnifiedSample[] = secretsSamples.map((s) => ({
      uid: `s-${s.id}`,
      ts: s.ts,
      source: 'secrets-manager',
      op: s.action,
      target: s.target,
      durationMs: s.durationMs,
      ok: s.ok,
      status: s.status,
      errorMessage: s.errorMessage,
      errorCode: s.errorCode,
      requestId: s.requestId,
      raw: s,
    }));
    return [...fromBridge, ...fromSecrets].sort((a, b) => b.ts - a.ts);
  }, [bridgeSamples, secretsSamples]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unified.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (statusFilter === 'ok' && !row.ok) return false;
      if (statusFilter === 'error' && row.ok) return false;
      if (q) {
        const haystack = [
          row.op,
          row.target,
          row.errorMessage,
          row.errorCode,
          row.requestId,
          row.serverRequestId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [unified, sourceFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const total = unified.length;
    const errors = unified.reduce((acc, s) => acc + (s.ok ? 0 : 1), 0);
    const lastTs = unified[0]?.ts;
    return { total, errors, lastTs };
  }, [unified]);

  // Auto-scroll para o topo quando uma nova amostra chega (já está no topo
  // por causa do sort desc; basta resetar a posição da ScrollArea).
  useEffect(() => {
    if (!autoScroll) return;
    const el = document.getElementById('edge-logs-scroll');
    if (el) el.scrollTop = 0;
  }, [filtered.length, autoScroll]);

  const handleClearAll = () => {
    clearBridgeSamples();
    clearSecretsManagerSamples();
    setExpandedUid(null);
    toast.info('Logs limpos');
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Logs Edge Functions (ao vivo)
            </CardTitle>
            <CardDescription className="text-xs">
              external-db-bridge · crm-db-bridge · secrets-manager — correlacione com os edge logs
              pelo <code className="font-mono">request_id</code>.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {counts.total} amostras
            </Badge>
            {counts.errors > 0 && (
              <Badge
                variant="outline"
                className="border-destructive/40 bg-destructive/10 font-mono text-[10px] text-destructive"
              >
                {counts.errors} erro(s)
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              title="Limpar logs em memória"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por op, target, request_id, mensagem…"
            className="h-8 max-w-sm text-xs"
          />
          <Button
            size="sm"
            variant={autoScroll ? 'secondary' : 'outline'}
            className="h-8 text-xs"
            onClick={() => setAutoScroll((v) => !v)}
            title="Mantém o topo da lista visível ao receber nova amostra"
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea id="edge-logs-scroll" className="h-[480px] w-full">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-[80px]">Hora</TableHead>
                <TableHead className="w-[160px]">Função</TableHead>
                <TableHead>Op / Alvo</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Latência</TableHead>
                <TableHead className="w-[140px]">request_id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    {unified.length === 0
                      ? 'Nenhuma chamada registrada ainda. Interaja com a app para popular o painel.'
                      : 'Nenhuma amostra corresponde aos filtros.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const expanded = expandedUid === row.uid;
                  const isBridge = row.source !== 'secrets-manager';
                  const bridgeRaw = isBridge ? (row.raw as BridgeCallSample) : null;
                  return (
                    <>
                      <TableRow
                        key={row.uid}
                        className={cn(
                          'cursor-pointer hover:bg-muted/40',
                          !row.ok && 'bg-destructive/5',
                        )}
                        onClick={() => setExpandedUid(expanded ? null : row.uid)}
                      >
                        <TableCell className="py-1.5">
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-[11px]">
                          {fmtTime(row.ts)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {row.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="font-mono text-xs">{row.op}</span>
                          {row.target && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              · {row.target}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              {row.status ?? 'ok'}
                            </span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                                  <XCircle className="h-3 w-3" />
                                  {row.status ?? 'err'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{row.errorMessage ?? 'Erro sem mensagem'}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-[11px]">
                          {row.durationMs} ms
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.requestId ? (
                            (() => {
                              const rid = row.requestId;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyText(rid, 'request_id');
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                                  title={rid}
                                >
                                  {shortRequestId(rid)}
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              );
                            })()
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${row.uid}-detail`} className="bg-muted/20">
                          <TableCell colSpan={7} className="py-3">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] md:grid-cols-3">
                              <dt className="text-muted-foreground">Timestamp</dt>
                              <dd className="col-span-2 font-mono">
                                {new Date(row.ts).toISOString()}
                              </dd>
                              <dt className="text-muted-foreground">request_id (cliente)</dt>
                              <dd className="col-span-2 flex items-center gap-2 font-mono">
                                {row.requestId ?? '—'}
                                {row.requestId &&
                                  (() => {
                                    const rid = row.requestId;
                                    return (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-5 w-5"
                                        onClick={() => copyText(rid, 'request_id')}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    );
                                  })()}
                              </dd>
                              {row.serverRequestId && (
                                <>
                                  <dt className="text-muted-foreground">request_id (servidor)</dt>
                                  <dd
                                    className={cn(
                                      'col-span-2 font-mono',
                                      row.serverRequestId === row.requestId ? '' : 'text-warning',
                                    )}
                                  >
                                    {row.serverRequestId}
                                    {row.serverRequestId !== row.requestId && (
                                      <span className="ml-2 text-[10px]">
                                        (diferente — verifique propagação)
                                      </span>
                                    )}
                                  </dd>
                                </>
                              )}
                              {bridgeRaw && (
                                <>
                                  <dt className="text-muted-foreground">Payload req / resp</dt>
                                  <dd className="col-span-2 font-mono">
                                    {fmtBytes(bridgeRaw.reqBytes)} → {fmtBytes(bridgeRaw.respBytes)}
                                  </dd>
                                </>
                              )}
                              {row.errorCode && (
                                <>
                                  <dt className="text-muted-foreground">Código erro</dt>
                                  <dd className="col-span-2 font-mono">{row.errorCode}</dd>
                                </>
                              )}
                              {row.errorMessage && (
                                <>
                                  <dt className="text-muted-foreground">Mensagem</dt>
                                  <dd className="col-span-2 break-all font-mono text-destructive">
                                    {row.errorMessage}
                                  </dd>
                                </>
                              )}
                              <dt className="text-muted-foreground">Como debugar</dt>
                              <dd className="col-span-2 text-muted-foreground">
                                <AlertCircle className="mr-1 inline h-3 w-3" />
                                Filtre os logs da função{' '}
                                <code className="font-mono">{row.source}</code> pelo request_id
                                acima para ver o trace completo no servidor.
                              </dd>
                            </dl>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
