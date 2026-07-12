/**
 * Linha individual da listagem de chaves MCP.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShieldAlert, RefreshCw, Trash2, Eye, ArrowDownLeft, Pencil } from 'lucide-react';
import type { McpKeyRow } from './useMcpKeys';

function formatExpiresIn(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expirada';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'expira hoje';
  if (days === 1) return 'expira em 1d';
  return `expira em ${days}d`;
}

function formatRelative(date: string | null): string {
  if (!date) return 'nunca usada';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60_000) return 'há instantes';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

interface Props {
  row: McpKeyRow;
  onRotate: (row: McpKeyRow) => void;
  onRevoke: (row: McpKeyRow) => void;
  onDetails: (row: McpKeyRow) => void;
  onEdit: (row: McpKeyRow) => void;
}

export function McpKeyRow({ row, onRotate, onRevoke, onDetails, onEdit }: Props) {
  const expiresLabel = formatExpiresIn(row.expires_at);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3 transition hover:bg-muted/30">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          <code className="text-xs text-muted-foreground">{row.key_prefix}…</code>
          {row.is_full && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <ShieldAlert className="h-3 w-3" /> FULL
            </Badge>
          )}
          {row.status === 'revoked' && (
            <Badge variant="destructive" className="text-xs">
              Revogada
            </Badge>
          )}
          {row.status === 'expired' && (
            <Badge variant="secondary" className="text-xs">
              Expirada
            </Badge>
          )}
          {row.status === 'active' && expiresLabel && (
            <Badge variant="outline" className="text-xs">
              {expiresLabel}
            </Badge>
          )}
          {row.rotated_from && (
            <Badge variant="outline" className="gap-1 text-xs" title="Resultado de rotação">
              <ArrowDownLeft className="h-3 w-3" /> rotação
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {row.scopes.map((s) => (
            <Badge
              key={s}
              variant={s === '*' ? 'destructive' : 'secondary'}
              className="font-mono text-[10px]"
            >
              {s}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            Criada por <strong>{row.creator_email ?? row.creator_name ?? '—'}</strong>
          </span>
          <span>•</span>
          <span>Último uso: {formatRelative(row.last_used_at)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => onDetails(row)} aria-label="Ver detalhes">
          <Eye className="h-4 w-4" />
        </Button>
        {row.status === 'active' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onEdit(row)} aria-label="Editar chave">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRotate(row)}
              aria-label="Rotacionar chave"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label="Revogar chave">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="!max-w-[400px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl" data-testid="mcp-key-revoke-dialog">
                <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-destructive to-transparent" />
                <div className="px-4 pb-1.5 pt-4">
                  <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-destructive/30" />
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
                          <Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={2.2} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                        <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                          Revogar "{row.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                          A chave para de funcionar imediatamente para todos os clientes que a utilizam. Esta ação é registrada no audit log e <strong className="text-foreground">não pode ser desfeita</strong>.
                        </AlertDialogDescription>
                      </div>
                    </div>
                  </AlertDialogHeader>
                </div>
                <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
                  <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                    <AlertDialogCancel className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onRevoke(row)}
                      className="inline-flex h-[26px] min-h-[26px] items-center rounded-md bg-destructive px-3.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revogar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
