/**
 * Painel de Auditoria de Roles
 *
 * Lista cronologicamente todas as mudanças de papel registradas em
 * `admin_audit_log` pelo trigger `audit_user_role_changes` e pela
 * edge function `manage-users` (action `promote_role`).
 *
 * Origem dos eventos:
 *  - role.granted   → trigger (INSERT em user_roles)
 *  - role.changed   → trigger (UPDATE em user_roles)
 *  - role.revoked   → trigger (DELETE em user_roles)
 *  - role.promote   → edge function manage-users
 *  - role.demote    → edge function manage-users
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, History, ArrowRight, RefreshCw } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleBadge } from '@/components/RoleBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ROLE_ACTIONS = [
  'role.granted',
  'role.changed',
  'role.revoked',
  'role.promote',
  'role.demote',
] as const;

type RoleAction = (typeof ROLE_ACTIONS)[number];

interface RoleAuditEntry {
  id: string;
  created_at: string;
  user_id: string; // ator
  action: RoleAction;
  resource_id: string | null; // alvo
  source: string | null;
  details: Record<string, unknown> | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const ACTION_LABEL: Record<
  RoleAction,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  'role.granted': { label: 'Concedido', variant: 'default' },
  'role.changed': { label: 'Alterado', variant: 'secondary' },
  'role.revoked': { label: 'Revogado', variant: 'destructive' },
  'role.promote': { label: 'Promovido', variant: 'default' },
  'role.demote': { label: 'Rebaixado', variant: 'outline' },
};

export function RoleAuditLogPanel() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | RoleAction>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['role-audit-log', actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_log')
        .select('id, created_at, user_id, action, resource_id, source, details')
        .in('action', [...ROLE_ACTIONS])
        .order('created_at', { ascending: false })
        .limit(200);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data: entries, error } = await query;
      if (error) throw error;

      const ids = new Set<string>();
      (entries ?? []).forEach((e) => {
        if (e.user_id) ids.add(e.user_id);
        if (e.resource_id) ids.add(e.resource_id);
      });

      const profilesMap = new Map<string, ProfileLite>();
      if (ids.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', [...ids]);
        (profiles ?? []).forEach((p) => {
          if (p.user_id) profilesMap.set(p.user_id, { ...p, user_id: p.user_id });
        });
      }

      return { entries: (entries ?? []) as RoleAuditEntry[], profilesMap };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const profilesMap = useMemo(() => data?.profilesMap ?? new Map<string, ProfileLite>(), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const actor = profilesMap.get(e.user_id);
      const target = e.resource_id ? profilesMap.get(e.resource_id) : null;
      return (
        (actor?.full_name ?? '').toLowerCase().includes(q) ||
        (actor?.email ?? '').toLowerCase().includes(q) ||
        (target?.full_name ?? '').toLowerCase().includes(q) ||
        (target?.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [entries, profilesMap, search]);

  const renderUser = (uid: string | null) => {
    if (!uid) return <span className="text-muted-foreground">—</span>;
    const p = profilesMap.get(uid);
    if (!p)
      return <span className="font-mono text-xs text-muted-foreground">{uid.slice(0, 8)}…</span>;
    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{p.full_name || 'Sem nome'}</span>
        {p.email && <span className="text-[11px] text-muted-foreground">{p.email}</span>}
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Auditoria de Roles</CardTitle>
            <CardDescription>
              Histórico completo de mudanças de papel — capturado automaticamente pelo trigger no
              banco e pela função de promoção.
            </CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Buscar por nome ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as typeof actionFilter)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {ROLE_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABEL[a].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma alteração de role registrada {search ? 'para esta busca' : 'ainda'}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Quando</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário-alvo</TableHead>
                  <TableHead>Mudança</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const oldRole = (entry.details?.old_role as string | null) ?? null;
                  const newRole = (entry.details?.new_role as string | null) ?? null;
                  const reason = (entry.details?.reason as string | undefined) ?? undefined;
                  const meta = ACTION_LABEL[entry.action];
                  const target = entry.resource_id;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm:ss', {
                              locale: ptBR,
                            })}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{renderUser(entry.user_id)}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>{renderUser(target)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {oldRole ? (
                            <RoleBadge role={oldRole} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {newRole ? (
                            <RoleBadge role={newRole} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {reason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-help text-[10px]">
                                  motivo
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{reason}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {entry.source || '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Mostrando até 200 registros mais recentes. Apenas DEV pode visualizar este log.
        </p>
      </CardContent>
    </Card>
  );
}
