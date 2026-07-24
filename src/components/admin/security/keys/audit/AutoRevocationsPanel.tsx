/**
 * AutoRevocationsPanel
 *
 * Observabilidade do mecanismo de defesa que revoga automaticamente chaves
 * MCP de escopo total ('*') quando o emissor original perde o papel dev.
 *
 * Backend:
 *   - Trigger: trg_user_roles_auto_revoke_mcp (latência zero ao remover role)
 *   - Cron: a cada 15min via auto_revoke_orphan_full_keys('cron')
 *   - Tabela: mcp_key_auto_revocations
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldOff, Zap, Clock, Wrench, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAutoRevocations, type AutoRevocationRow } from './useAutoRevocations';

const SOURCE_META: Record<
  AutoRevocationRow['source'],
  { label: string; Icon: typeof Zap; variant: 'default' | 'outline' | 'secondary' }
> = {
  trigger: { label: 'Trigger (instantâneo)', Icon: Zap, variant: 'default' },
  cron: { label: 'Varredura periódica', Icon: Clock, variant: 'secondary' },
  manual: { label: 'Execução manual', Icon: Wrench, variant: 'outline' },
};

export function AutoRevocationsPanel() {
  const { data: rows, isLoading, error } = useAutoRevocations();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-destructive" />
          <CardTitle>Auto-revogações de chaves FULL</CardTitle>
        </div>
        <CardDescription>
          Chaves MCP com escopo total revogadas automaticamente porque o emissor perdeu o papel{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">dev</code>. O sistema atua via
          trigger (imediato) e varredura defensiva a cada 15min.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Falha desconhecida'}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <ShieldOff className="mx-auto mb-3 h-10 w-10 opacity-30" />
            Nenhuma auto-revogação registrada — todos os emissores de chaves FULL ativas mantêm o
            papel <code className="text-xs">dev</code>.
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <ul className="space-y-2">
              {rows.map((row) => {
                const meta = SOURCE_META[row.source];
                const Icon = meta.Icon;
                return (
                  <li
                    key={row.id}
                    className="rounded-md border border-border p-3 transition-colors hover:bg-accent/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {row.key_name ?? (
                              <span className="italic text-muted-foreground">chave removida</span>
                            )}
                          </span>
                          {row.key_prefix && (
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              {row.key_prefix}…
                            </code>
                          )}
                          <Badge variant="destructive" className="text-[10px]">
                            FULL revogada
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Emissor:{' '}
                            <span className="font-medium text-foreground">
                              {row.actor_email ?? row.created_by.slice(0, 8)}
                            </span>
                          </span>
                          <span>•</span>
                          <span>
                            {format(new Date(row.revoked_at), 'dd/MM/yyyy HH:mm:ss', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Motivo: <code className="rounded bg-muted px-1 py-0.5">{row.reason}</code>
                        </div>
                      </div>
                      <Badge variant={meta.variant} className="shrink-0 gap-1">
                        <Icon className="h-3 w-3" />
                        <span className="text-[10px]">{meta.label}</span>
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
