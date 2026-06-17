/**
 * RlsDenialsAdminPage — Painel admin para auditar tentativas negadas pelo RLS.
 *
 * Mostra: lista paginada com filtros (tabela, operação, vendedor, janela temporal),
 * resumo (top vendedores, top tabelas) e alerta visual quando o volume excede
 * threshold (>= 10 negações nas últimas 24h).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, ArrowLeft, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALERT_THRESHOLD_24H = 10;

interface DenialRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_role: string | null;
  table_name: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  endpoint: string | null;
  query_summary: string | null;
  target_id: string | null;
  target_seller_id: string | null;
  policy_hint: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export default function RlsDenialsAdminPage() {
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [opFilter, setOpFilter] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState('');
  const [windowHours, setWindowHours] = useState<string>('168'); // 7 dias

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['rls-denials', tableFilter, opFilter, emailFilter, windowHours],
    queryFn: async (): Promise<DenialRow[]> => {
      const since = new Date(Date.now() - Number(windowHours) * 3600 * 1000).toISOString();
      let q = supabase
        .from('rls_denial_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
      if (opFilter !== 'all') q = q.eq('operation', opFilter);
      if (emailFilter.trim()) q = q.ilike('user_email', `%${emailFilter.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DenialRow[];
    },
    refetchInterval: 30_000,
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const last24h = rows.filter((r) => Date.parse(r.created_at) > Date.now() - 24 * 3600 * 1000);
    const byTable = new Map<string, number>();
    const byUser = new Map<string, { email: string | null; count: number }>();
    const byPolicy = new Map<string, number>();
    rows.forEach((r) => {
      byTable.set(r.table_name, (byTable.get(r.table_name) ?? 0) + 1);
      const u = byUser.get(r.user_id) ?? { email: r.user_email, count: 0 };
      u.count++;
      u.email = r.user_email ?? u.email;
      byUser.set(r.user_id, u);
      if (r.policy_hint) byPolicy.set(r.policy_hint, (byPolicy.get(r.policy_hint) ?? 0) + 1);
    });
    return {
      total: rows.length,
      last24h: last24h.length,
      topTables: [...byTable.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topUsers: [...byUser.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5),
      topPolicies: [...byPolicy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [data]);

  const tables = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.table_name));
    return [...set].sort();
  }, [data]);

  const alertActive = stats.last24h >= ALERT_THRESHOLD_24H;

  return (
    <>
      <PageSEO
        title="Tentativas negadas (RLS) — Admin"
        description="Auditoria de tentativas de acesso bloqueadas pelas políticas de Row-Level Security."
        path="/admin/rls-denials"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-destructive/10 p-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1
                data-testid="page-title-rls-denials"
                className="font-display text-3xl font-bold tracking-tight"
              >
                Acessos negados (RLS)
              </h1>
              <p className="text-muted-foreground">
                Toda vez que uma política bloqueia uma operação, o evento é registrado aqui.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('mr-1 h-4 w-4', isFetching && 'animate-spin')} /> Atualizar
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/seguranca">
                <ArrowLeft className="mr-1 h-4 w-4" /> Segurança
              </Link>
            </Button>
          </div>
        </div>

        {alertActive && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Volume anormal de negações nas últimas 24h</AlertTitle>
            <AlertDescription>
              {stats.last24h} eventos registrados (limiar: {ALERT_THRESHOLD_24H}). Investigue os
              usuários e tabelas listados abaixo — pode indicar bug de UI, escalonamento de
              privilégio ou tentativa maliciosa.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total na janela</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Últimas 24h</p>
              <p className={cn('text-2xl font-bold', alertActive && 'text-destructive')}>
                {stats.last24h}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tabelas distintas</p>
              <p className="text-2xl font-bold">{stats.topTables.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Usuários distintos</p>
              <p className="text-2xl font-bold">{stats.topUsers.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Janela</label>
              <Select value={windowHours} onValueChange={setWindowHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Última hora</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                  <SelectItem value="720">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tabela</label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {tables.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Operação</label>
              <Select value={opFilter} onValueChange={setOpFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="SELECT">SELECT</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email do usuário</label>
              <Input
                placeholder="filtrar por email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Top users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top vendedores negados</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem eventos.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {stats.topUsers.map(([uid, v]) => (
                    <li key={uid} className="flex items-center justify-between">
                      <span className="truncate" title={uid}>
                        {v.email ?? `${uid.slice(0, 8)}…`}
                      </span>
                      <Badge variant="destructive">{v.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top tables */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top tabelas</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topTables.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem eventos.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {stats.topTables.map(([t, n]) => (
                    <li key={t} className="flex items-center justify-between">
                      <code>{t}</code>
                      <Badge variant="outline">{n}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top policies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Políticas mais acionadas</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topPolicies.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dica de política capturada.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {stats.topPolicies.map(([p, n]) => (
                    <li key={p} className="flex items-center justify-between">
                      <code>{p}</code>
                      <Badge variant="outline">{n}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista detalhada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos ({data?.length ?? 0})</CardTitle>
            <CardDescription>
              Ordenados do mais recente para o mais antigo. Limite de 500.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma negação registrada nesta janela. ✅
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40">
                    <tr className="text-left">
                      <th className="p-2">Quando</th>
                      <th className="p-2">Usuário</th>
                      <th className="p-2">Tabela</th>
                      <th className="p-2">Op</th>
                      <th className="p-2">Endpoint</th>
                      <th className="p-2">Política</th>
                      <th className="p-2">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data ?? []).map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="whitespace-nowrap p-2 text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <div
                            className="max-w-[180px] truncate font-medium"
                            title={r.user_email ?? ''}
                          >
                            {r.user_email ?? r.user_id.slice(0, 8)}
                          </div>
                          {r.user_role && (
                            <Badge variant="outline" className="text-[9px]">
                              {r.user_role}
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <code>{r.table_name}</code>
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.operation}
                          </Badge>
                        </td>
                        <td className="max-w-[160px] truncate p-2" title={r.endpoint ?? ''}>
                          {r.endpoint ?? '—'}
                        </td>
                        <td className="p-2">
                          <code className="text-[10px]">{r.policy_hint ?? '—'}</code>
                        </td>
                        <td className="max-w-[260px] p-2 text-muted-foreground">
                          {r.query_summary && (
                            <div className="truncate" title={r.query_summary}>
                              {r.query_summary}
                            </div>
                          )}
                          {r.target_id && (
                            <div className="text-[10px]">
                              alvo: <code>{r.target_id.slice(0, 8)}…</code>
                            </div>
                          )}
                          {r.error_message && (
                            <div
                              className="truncate text-[10px] text-destructive"
                              title={r.error_message}
                            >
                              {r.error_message}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
