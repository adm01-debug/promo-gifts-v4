/**
 * Drawer com detalhes técnicos de uma chave MCP + audit log filtrado
 * por `resource_id`. Read-only, complementa a linha do listado.
 */
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ClipboardList } from 'lucide-react';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { McpKeyRow } from './useMcpKeys';

interface AuditEntry {
  id: string;
  action: string;
  user_id: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
}

interface Props {
  source: McpKeyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_LABELS: Record<string, string> = {
  'mcp_key.issued': 'Emitida',
  'mcp_key.rotated': 'Rotacionada',
  'mcp_key.revoked': 'Revogada',
};

export function McpKeyDetailsDrawer({ source, open, onOpenChange }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // BUG-MCPKEYDETAILS-AUDITLOG-SELECT-SILENT-FAIL FIX: { data } without error check —
      // RLS failure silently showed "nenhum evento registrado" instead of actual error.
      const { data, error: auditErr } = await supabase
        .from('admin_audit_log')
        .select('id, action, user_id, created_at, ip_address, user_agent, details')
        .eq('resource_type', 'mcp_api_key')
        .eq('resource_id', source.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (auditErr) {
        logger.error('[McpKeyDetailsDrawer] Failed to load audit log:', auditErr);
      }
      if (!cancelled) {
        setEntries((data ?? []) as AuditEntry[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {source?.is_full && <ShieldAlert className="h-4 w-4 text-destructive" />}
            {source?.name ?? 'Chave MCP'}
          </SheetTitle>
          <SheetDescription>
            <code className="font-mono text-xs">{source?.key_prefix}…</code>
          </SheetDescription>
        </SheetHeader>

        {source && (
          <ScrollArea className="-mr-6 mt-4 flex-1 pr-6">
            <div className="space-y-4 text-sm">
              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Status</h3>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={source.status === 'active' ? 'outline' : 'destructive'}>
                    {source.status === 'active'
                      ? 'Ativa'
                      : source.status === 'expired'
                        ? 'Expirada'
                        : 'Revogada'}
                  </Badge>
                  {source.is_full && <Badge variant="destructive">FULL</Badge>}
                </div>
              </section>

              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Escopos</h3>
                <div className="flex flex-wrap gap-1">
                  {source.scopes.map((s) => (
                    <Badge
                      key={s}
                      variant={s === '*' ? 'destructive' : 'secondary'}
                      className="font-mono text-xs"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Datas</h3>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>
                    Criada em:{' '}
                    {format(new Date(source.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </li>
                  <li>
                    Expira:{' '}
                    {source.expires_at
                      ? format(new Date(source.expires_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : 'sem expiração'}
                  </li>
                  <li>
                    Último uso:{' '}
                    {source.last_used_at
                      ? format(new Date(source.last_used_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : 'nunca usada'}
                  </li>
                  {source.revoked_at && (
                    <li>
                      Revogada em:{' '}
                      {format(new Date(source.revoked_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </li>
                  )}
                </ul>
              </section>

              <section className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Criador</h3>
                <p>{source.creator_name ?? source.creator_email ?? source.created_by}</p>
                {source.creator_email && source.creator_name && (
                  <p className="text-xs text-muted-foreground">{source.creator_email}</p>
                )}
              </section>

              {source.rotated_from && (
                <section className="space-y-1">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                    Origem da rotação
                  </h3>
                  <p className="break-all font-mono text-xs">{source.rotated_from}</p>
                </section>
              )}

              {source.description && (
                <section className="space-y-1">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                    Justificativa registrada
                  </h3>
                  <p className="text-xs italic">"{source.description}"</p>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <ClipboardList className="h-3 w-3" /> Histórico de auditoria
                </h3>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {entries.map((e) => (
                      <li key={e.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline" className="text-xs">
                            {ACTION_LABELS[e.action] ?? e.action}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(new Date(e.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                          </span>
                        </div>
                        {e.ip_address && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            IP: {e.ip_address}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
