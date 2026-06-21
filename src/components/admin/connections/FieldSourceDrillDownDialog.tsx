import { ExternalLink, KeyRound, Database, GitMerge, FileCode2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export type FieldSourceKind =
  | 'ambos (sync trigger)'
  | 'external_connections'
  | 'integration_credentials';

export type FieldDrillDownSample = {
  /** Identificador da linha amostrada (ex.: nome do secret, env_key, id da conexão) */
  label: string;
  /** Valor mascarado ou status textual exato (ex.: "active", "••••a1b2", "2026-04-25T17:30Z") */
  display: string;
  /** Selo opcional para classificar o estado */
  badge?: { text: string; tone: 'error' | 'neutral' | 'ok' | 'warn' };
};

export type FieldDrillDownData = {
  field: string;
  description: string;
  source: FieldSourceKind;
  notes: string;
  /** Origem técnica: query SQL, RPC, Edge Function, hook, etc. */
  technicalSource: {
    kind: 'edge_function' | 'hook' | 'rpc' | 'table_query' | 'trigger';
    name: string;
    snippet: string;
    docsHref?: string;
  };
  /** Amostras reais do estado atual (valor mascarado / status) */
  samples: FieldDrillDownSample[];
  /** Mensagem quando não há nada para mostrar */
  emptyMessage?: string;
};

export type FieldSourceDrillDownDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FieldDrillDownData | null;
};

const sourceBadgeClass = (s: FieldSourceKind) =>
  s === 'integration_credentials'
    ? 'border-primary/40 text-primary'
    : s === 'external_connections'
      ? 'border-blue-500/40 text-blue-600'
      : 'border-green-500/40 text-green-700';

const toneClass = (tone: NonNullable<FieldDrillDownSample['badge']>['tone']) => {
  switch (tone) {
    case 'ok':
      return 'border-green-500/40 text-green-700 bg-green-500/5';
    case 'warn':
      return 'border-amber-500/40 text-amber-700 bg-amber-500/5';
    case 'error':
      return 'border-destructive/40 text-destructive bg-destructive/5';
    default:
      return 'border-muted-foreground/30 text-muted-foreground';
  }
};

const kindIcon = (kind: FieldDrillDownData['technicalSource']['kind']) => {
  switch (kind) {
    case 'edge_function':
      return <FileCode2 className="h-3.5 w-3.5" />;
    case 'table_query':
      return <Database className="h-3.5 w-3.5" />;
    case 'rpc':
      return <FileCode2 className="h-3.5 w-3.5" />;
    case 'trigger':
      return <GitMerge className="h-3.5 w-3.5" />;
    case 'hook':
      return <KeyRound className="h-3.5 w-3.5" />;
  }
};

export function FieldSourceDrillDownDialog({
  open,
  onOpenChange,
  data,
}: FieldSourceDrillDownDialogProps) {
  const [copied, setCopied] = useState(false);

  const copySnippet = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.technicalSource.snippet);
      setCopied(true);
      toast.success('Trecho copiado');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Falha ao copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {data && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-base">{data.field}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">{data.description}</DialogDescription>
                </div>
                <Badge variant="outline" className={`shrink-0 ${sourceBadgeClass(data.source)}`}>
                  {data.source}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Origem técnica */}
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {kindIcon(data.technicalSource.kind)}
                    <span className="uppercase tracking-wide text-muted-foreground">
                      {data.technicalSource.kind.replace('_', ' ')}
                    </span>
                    <code className="rounded border bg-background px-1.5 py-0.5 text-[11px]">
                      {data.technicalSource.name}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={copySnippet}
                    >
                      {copied ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      Copiar
                    </Button>
                    {data.technicalSource.docsHref && (
                      <a
                        href={data.technicalSource.docsHref}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:underline"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <pre className="overflow-x-auto whitespace-pre rounded border bg-background p-2 font-mono text-[11px]">
                  {data.technicalSource.snippet}
                </pre>
                <p className="text-[11px] text-muted-foreground">{data.notes}</p>
              </div>

              {/* Amostras (valor mascarado / status real) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado atual ({data.samples.length})
                  </h4>
                </div>
                {data.samples.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    {data.emptyMessage ?? 'Nenhuma amostra disponível no momento.'}
                  </p>
                ) : (
                  <ScrollArea className="max-h-64 rounded-lg border">
                    <ul className="divide-y">
                      {data.samples.map((s, i) => (
                        <li
                          key={`${s.label}-${i}`}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs font-medium">{s.label}</div>
                            <div className="truncate font-mono text-[11px] text-muted-foreground">
                              {s.display}
                            </div>
                          </div>
                          {s.badge && (
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] ${toneClass(s.badge.tone)}`}
                            >
                              {s.badge.text}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
