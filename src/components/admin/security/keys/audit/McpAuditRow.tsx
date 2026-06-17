/**
 * Linha de evento de auditoria de chave MCP.
 * Mostra ator, ação, prefixo, IP e diff resumido para eventos `updated`.
 */
import { Badge } from '@/components/ui/badge';
import { KeyRound, RotateCw, Pencil, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditFeedRow } from './useMcpAuditFeed';
import { cn } from '@/lib/utils';

const META: Record<string, { label: string; Icon: typeof KeyRound; tone: string }> = {
  'mcp_key.issued': { label: 'Emitida', Icon: KeyRound, tone: 'text-emerald-600' },
  'mcp_key.rotated': { label: 'Rotacionada', Icon: RotateCw, tone: 'text-blue-600' },
  'mcp_key.updated': { label: 'Editada', Icon: Pencil, tone: 'text-amber-600' },
  'mcp_key.revoked': { label: 'Revogada', Icon: XCircle, tone: 'text-destructive' },
  'mcp_key.scope_escalated': {
    label: 'Escalada p/ FULL',
    Icon: AlertTriangle,
    tone: 'text-destructive',
  },
  'mcp_key.auto_revoked': { label: 'Auto-revogada', Icon: XCircle, tone: 'text-destructive' },
};

interface Props {
  row: AuditFeedRow;
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export function McpAuditRow({ row }: Props) {
  const meta = META[row.action] ?? {
    label: row.action,
    Icon: KeyRound,
    tone: 'text-muted-foreground',
  };
  const Icon = meta.Icon;
  const d = (row.details ?? {}) as Record<string, unknown>;
  const fields = arr(d.fields_changed);
  const diff = (d.diff ?? {}) as Record<string, { before?: unknown; after?: unknown }>;
  const beforeScopes = arr(diff.scopes?.before ?? d.before_scopes);
  const afterScopes = arr(diff.scopes?.after ?? d.after_scopes);

  return (
    <li className="rounded-md border border-border p-3 transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', meta.tone)} />
          <Badge variant="outline" className="text-xs">
            {meta.label}
          </Badge>
          {row.is_full && (
            <Badge variant="destructive" className="text-xs">
              FULL
            </Badge>
          )}
          {row.escalated && row.action !== 'mcp_key.scope_escalated' && (
            <Badge variant="destructive" className="text-xs">
              ESCALAÇÃO
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <span className="font-medium text-foreground">
            {row.actor_name ?? row.actor_email ?? row.user_id ?? '—'}
          </span>
          {row.actor_email && row.actor_name && <span className="ml-1">({row.actor_email})</span>}
        </div>
        <div className="font-mono">{row.key_prefix ? `${row.key_prefix}…` : ''}</div>
      </div>

      {fields.length > 0 && (
        <div className="mt-2 text-xs">
          <span className="text-muted-foreground">Campos: </span>
          {fields.map((f) => (
            <Badge key={f} variant="secondary" className="mr-1 font-mono text-[10px]">
              {f}
            </Badge>
          ))}
        </div>
      )}

      {(beforeScopes.length > 0 || afterScopes.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Escopos:</span>
          <span className="font-mono text-muted-foreground/70 line-through">
            {beforeScopes.join(', ') || '—'}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono text-foreground">{afterScopes.join(', ') || '—'}</span>
        </div>
      )}

      {!!(d.target_repo || d.target_tool || d.expires_at || (row.is_full && d.justification)) && (
        <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
          {d.target_repo ? (
            <div>
              <span className="text-muted-foreground">Repo: </span>
              <span className="font-mono text-foreground">{String(d.target_repo)}</span>
            </div>
          ) : null}
          {d.target_tool ? (
            <div>
              <span className="text-muted-foreground">Tool: </span>
              <span className="font-mono text-foreground">{String(d.target_tool)}</span>
            </div>
          ) : null}
          {d.expires_at ? (
            <div>
              <span className="text-muted-foreground">Expira: </span>
              <span className="font-mono text-foreground">
                {format(new Date(String(d.expires_at)), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            </div>
          ) : null}
          {d.step_up_verified === true ? (
            <div>
              <Badge variant="outline" className="text-[10px]">
                ✓ Verificação dupla
              </Badge>
            </div>
          ) : null}
          {row.is_full && d.justification ? (
            <div className="italic text-muted-foreground sm:col-span-2">
              "{String(d.justification)}"
            </div>
          ) : null}
        </div>
      )}

      {(row.request_id || row.duration_ms !== null || row.status || row.source) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          {row.status && (
            <Badge
              variant={
                row.status === 'success'
                  ? 'outline'
                  : row.status === 'denied'
                    ? 'secondary'
                    : 'destructive'
              }
              className="text-[10px] uppercase"
            >
              {row.status}
            </Badge>
          )}
          {row.source && <span>src: {row.source}</span>}
          {row.duration_ms !== null && <span>· {row.duration_ms}ms</span>}
          {row.request_id && (
            <span title={row.request_id}>· req: {row.request_id.slice(0, 8)}…</span>
          )}
        </div>
      )}

      {row.ip_address && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          IP: {row.ip_address}
          {row.user_agent && (
            <span className="ml-2 inline-block max-w-[300px] truncate align-middle">
              UA: {row.user_agent}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
