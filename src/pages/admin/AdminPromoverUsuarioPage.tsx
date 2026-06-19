/**
 * Página dedicada para promover Agente -> Supervisor.
 *
 * - Lista APENAS agentes (role = vendedor) ativos
 * - Mostra comparativo lado-a-lado das permissões
 * - Step-up de senha + justificativa via PromotionDialog
 * - Exige supervisor ou dev (guard duplo: ProtectedRoute + checagem local)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
} from 'lucide-react';
import { useUserManagement } from '@/components/admin/users/useUserManagement';
import { PromotionDialog } from '@/components/admin/users/PromotionDialog';
import type { UserWithRole } from '@/components/admin/users/types';

type PermissionRow = { label: string; agente: boolean; supervisor: boolean };

const PERMISSIONS: PermissionRow[] = [
  { label: 'Catálogo, orçamentos próprios e CRM básico', agente: true, supervisor: true },
  { label: 'Favoritos, comparador e coleções', agente: true, supervisor: true },
  { label: 'Aprovação de descontos fora da alçada', agente: false, supervisor: true },
  { label: 'Gestão de orçamentos da equipe', agente: false, supervisor: true },
  { label: 'Cadastros (produtos, clientes, fornecedores)', agente: false, supervisor: true },
  { label: 'Relatórios e BI completo', agente: false, supervisor: true },
  { label: 'Promover/rebaixar outros agentes', agente: false, supervisor: true },
];

export default function AdminPromoverUsuarioPage() {
  const { user, isSupervisorOrAbove } = useAuth();
  const { users, isLoading, fetchUsers } = useUserManagement();
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Lista apenas agentes (role 'vendedor') ativos e diferentes do próprio caller.
  const agentes = useMemo(() => {
    return users
      .filter((u) => u.role === 'vendedor' && u.is_active !== false && u.user_id !== user?.id)
      .filter((u) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR', {
          sensitivity: 'base',
        }),
      );
  }, [users, search, user?.id]);

  // Guard de UI extra (ProtectedRoute já cobre, mas evita flash em reload)
  if (!isSupervisorOrAbove) {
    return (
      <>
        <PageSEO
          title="Acesso Restrito"
          description="Acesso negado ao módulo de promoção."
          path="/admin/usuarios/promover"
          noIndex
        />
        <div className="mx-auto max-w-2xl py-12 text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="text-muted-foreground">Apenas supervisores podem promover agentes.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageSEO
        title="Promover Agente"
        description="Promover um agente a supervisor com auditoria e step-up de segurança."
        path="/admin/usuarios/promover"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar">
            <Link to="/admin/usuarios">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="rounded-xl bg-primary/10 p-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-promover-usuario"
              className="font-display text-3xl font-bold tracking-tight"
            >
              Promover Agente
            </h1>
            <p className="text-muted-foreground">
              Selecione um agente e promova-o a supervisor com justificativa.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Comparativo de permissões */}
          <Card className="border-border/50 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">O que muda</CardTitle>
              <CardDescription>Permissões antes e depois.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-sm">
                <div className="text-xs font-semibold text-muted-foreground" />
                <div className="text-center text-xs font-semibold text-muted-foreground">
                  Agente
                </div>
                <div className="text-center text-xs font-semibold text-primary">Supervisor</div>
                {PERMISSIONS.map((p) => (
                  <PermissionLine key={p.label} row={p} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lista de agentes */}
          <Card className="border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Agentes elegíveis</CardTitle>
              <CardDescription>
                {isLoading
                  ? 'Carregando…'
                  : `${agentes.length} agente(s) ativo(s) disponível(is) para promoção.`}
              </CardDescription>
              <div className="relative max-w-sm pt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : agentes.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum agente encontrado para promover.
                </div>
              ) : (
                <ul className="divide-y">
                  {agentes.map((u) => (
                    <li key={u.user_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar_url || undefined} alt={u.full_name ?? ''} />
                          <AvatarFallback className="bg-muted text-xs">
                            {(u.full_name || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.full_name || 'Sem nome'}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.email || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">Agente</Badge>
                        <Button size="sm" onClick={() => setTarget(u)} className="gap-1">
                          Promover
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <PromotionDialog
          user={target}
          targetRole="supervisor"
          open={!!target}
          onOpenChange={(open) => {
            if (!open) setTarget(null);
          }}
          onSuccess={() => {
            void fetchUsers();
          }}
        />
      </div>
    </>
  );
}

function PermissionLine({ row }: { row: PermissionRow }) {
  return (
    <>
      <div className="pt-0.5 text-sm leading-tight">{row.label}</div>
      <div className="flex justify-center pt-0.5">
        {row.agente ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex justify-center pt-0.5">
        {row.supervisor ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
    </>
  );
}
