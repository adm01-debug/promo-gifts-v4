/**
 * Drawer lateral com detalhes de uma chamada de bridge específica,
 * acessada via request_id na lista de "Últimas chamadas".
 *
 * Usa o request_id (correlation-id) propagado entre client e edge function
 * para permitir buscar logs do servidor com o mesmo identificador.
 */
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { BridgeCallSample } from '@/lib/telemetry/bridgeCallMetrics';

interface Props {
  sample: BridgeCallSample | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function BridgeCallDetailDrawer({ sample, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  if (!sample) return null;

  const idsMatch =
    sample.requestId && sample.serverRequestId ? sample.requestId === sample.serverRequestId : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Detalhes da chamada
            <Badge variant={sample.ok ? 'secondary' : 'destructive'} className="text-[10px]">
              {sample.ok ? 'OK' : 'ERRO'}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Use o request-id para correlacionar com os logs do edge function.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Request ID — destaque */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Request ID (client)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs">
                {sample.requestId ?? '—'}
              </code>
              {sample.requestId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sample.requestId && copy('Request ID', sample.requestId)}
                >
                  {copied === 'Request ID' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
            {sample.serverRequestId && (
              <>
                <p className="pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Request ID (server eco)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs">
                    {sample.serverRequestId}
                  </code>
                  {idsMatch === false && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                      <AlertCircle className="h-3 w-3" /> divergente
                    </Badge>
                  )}
                  {idsMatch === true && (
                    <Badge variant="secondary" className="text-[10px]">
                      match ✓
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Identificação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bridge</p>
              <p className="font-mono text-sm font-medium">{sample.bridge}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Operação</p>
              <p className="font-mono text-sm font-medium">{sample.op}</p>
            </div>
            {sample.target && (
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Alvo</p>
                <p className="break-all font-mono text-xs">{sample.target}</p>
              </div>
            )}
          </div>

          {/* Timing & sizes */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Latência</p>
              <p className="font-display text-lg font-bold tabular-nums">
                {formatMs(sample.durationMs)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Enviado</p>
              <p className="font-display text-lg font-bold tabular-nums">
                {formatBytes(sample.reqBytes)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recebido</p>
              <p className="font-display text-lg font-bold tabular-nums">
                {formatBytes(sample.respBytes)}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Quando:</span>{' '}
              {new Date(sample.ts).toLocaleString('pt-BR')}
            </p>
            {typeof sample.status === 'number' && (
              <p>
                <span className="font-medium text-foreground">Status HTTP:</span> {sample.status}
              </p>
            )}
          </div>

          {/* Erro */}
          {sample.errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-destructive">
                Erro
              </p>
              <p className="break-words font-mono text-xs text-destructive/90">
                {sample.errorMessage}
              </p>
            </div>
          )}

          {/* Hint p/ logs do servidor */}
          {sample.requestId && (
            <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              💡 Para encontrar este request nos logs do edge function, busque por:
              <code className="mt-1 block rounded bg-muted/50 px-2 py-1 font-mono">
                req_id={sample.requestId}
              </code>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default BridgeCallDetailDrawer;
