/**
 * WebhookPlaygroundPanel — Onda 13 #9
 * Card "Testar payload" no fluxo outbound: seleciona webhook + evento do
 * catálogo SSOT, mostra payload de exemplo editável e dispara em modo teste
 * (não conta em consecutive_failures, não persiste em webhook_deliveries).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Beaker, Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { WEBHOOK_EVENTS_CATALOG } from '@/lib/webhook-events-catalog';
import { getEventSamplePayload } from '@/lib/webhook-events-payload-samples';
import { cn } from '@/lib/utils';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';

interface OutboundHookOption {
  id: string;
  name: string;
  url: string;
  events: string[];
}

interface TestResult {
  success: boolean;
  status_code: number | null;
  latency_ms: number;
  response_body?: string;
  error?: string;
}

interface Props {
  webhooks: OutboundHookOption[];
}

export function WebhookPlaygroundPanel({ webhooks }: Props) {
  const [hookId, setHookId] = useState<string>('');
  const [event, setEvent] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const selectedHook = useMemo(() => webhooks.find((h) => h.id === hookId), [hookId, webhooks]);
  const subscribedEvents = selectedHook?.events ?? [];

  const handleEventChange = (key: string) => {
    setEvent(key);
    setPayload(JSON.stringify(getEventSamplePayload(key), null, 2));
    setParseError(null);
    setResult(null);
  };

  const handleDispatch = async () => {
    if (!hookId || !event) {
      toast.error('Selecione webhook e evento');
      return;
    }
    let parsed: unknown = null;
    try {
      parsed = payload.trim() ? JSON.parse(payload) : null;
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'JSON inválido');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await invokeEdge<{
        success?: boolean;
        status_code?: number | null;
        latency_ms?: number;
        response_body?: string;
        error?: string;
      }>('webhook-dispatcher', {
        body: {
          event,
          payload: parsed,
          test_mode: true,
          test_webhook_id: hookId,
        },
      });
      if (error) throw error;
      setResult({
        success: !!data?.success,
        status_code: data?.status_code ?? null,
        latency_ms: data?.latency_ms ?? 0,
        response_body: data?.response_body,
        error: data?.error,
      });
      if (data?.success)
        toast.success('Payload entregue', {
          description: `HTTP ${data.status_code} em ${data.latency_ms}ms`,
        });
      else
        toast.warning('Destino respondeu com erro', {
          description: data?.error ?? `HTTP ${data?.status_code ?? '?'}`,
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      setResult({ success: false, status_code: null, latency_ms: 0, error: msg });
      toast.error('Falha ao disparar', { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Beaker className="h-4 w-4 text-primary" /> Playground — Testar payload
        </CardTitle>
        <CardDescription>
          Dispare um evento de teste para um webhook. <strong>Não conta</strong> em métricas de
          falha, não persiste em entregas e não aciona o circuit breaker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Webhook</Label>
            <Select
              value={hookId}
              onValueChange={(v) => {
                setHookId(v);
                setEvent('');
                setPayload('');
                setResult(null);
              }}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Escolha um webhook…" />
              </SelectTrigger>
              <SelectContent>
                {webhooks.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Nenhum webhook cadastrado
                  </SelectItem>
                ) : (
                  webhooks.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}{' '}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({h.events.length} ev.)
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Evento</Label>
            <Select value={event} onValueChange={handleEventChange} disabled={!hookId}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue
                  placeholder={hookId ? 'Escolha o evento…' : 'Selecione um webhook primeiro'}
                />
              </SelectTrigger>
              <SelectContent>
                {WEBHOOK_EVENTS_CATALOG.map((g) => {
                  const visible = g.events.filter(
                    (e) => subscribedEvents.length === 0 || subscribedEvents.includes(e.key),
                  );
                  if (visible.length === 0) return null;
                  return (
                    <SelectGroup key={g.category}>
                      <SelectLabel className="text-[10px]">{g.label}</SelectLabel>
                      {visible.map((e) => (
                        <SelectItem key={e.key} value={e.key} className="text-xs">
                          <span className="font-mono">{e.key}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedHook && subscribedEvents.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {subscribedEvents.length} evento(s) inscrito(s) neste webhook
              </p>
            )}
          </div>
        </div>

        {event && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">Payload (JSON editável)</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => setPayload(JSON.stringify(getEventSamplePayload(event), null, 2))}
              >
                Resetar exemplo
              </Button>
            </div>
            <Textarea
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                setParseError(null);
              }}
              className="max-h-[300px] min-h-[180px] font-mono text-[11px]"
              spellCheck={false}
            />
            {parseError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" /> JSON inválido: {parseError}
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleDispatch}
          disabled={!hookId || !event || busy}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Disparar teste
        </Button>

        {result && (
          <div
            className={cn(
              'rounded-lg border p-3',
              result.success
                ? 'border-success/20 bg-success/5'
                : 'border-destructive/20 bg-destructive/5',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">{result.success ? 'Sucesso' : 'Falha'}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.status_code !== null && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    HTTP {result.status_code}
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {result.latency_ms}ms
                </Badge>
              </div>
            </div>
            {result.error && <p className="mb-2 text-xs text-destructive">{result.error}</p>}
            {result.response_body && (
              <pre className="max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[10px]">
                {result.response_body || '(vazio)'}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
