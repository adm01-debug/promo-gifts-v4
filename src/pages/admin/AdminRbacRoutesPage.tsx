import { useMemo, useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Search,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  RBAC_ROUTES,
  summarizeRoutes,
  findInconsistencies,
  type RbacRouteEntry,
  type RouteRole,
  type RouteGuard,
} from '@/lib/rbac/route-matrix';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABEL: Record<RouteRole, string> = {
  public: 'Público',
  authenticated: 'Autenticado',
  admin: 'Admin',
  dev: 'Dev',
};

const ROLE_VARIANT: Record<RouteRole, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  public: 'outline',
  authenticated: 'secondary',
  admin: 'default',
  dev: 'destructive',
};

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const RBAC_SUMMARY = summarizeRoutes(RBAC_ROUTES);
const RBAC_ISSUES = findInconsistencies(RBAC_ROUTES);

function toCsv(rows: RbacRouteEntry[]): string {
  const header = ['path', 'label', 'guard', 'role', 'mfa_aal2', 'rls_helper', 'category', 'notes'];
  const lines = rows.map((r) =>
    [
      r.path,
      r.label,
      r.guard,
      r.role,
      r.mfaAal2 ? 'yes' : 'no',
      r.rlsHelper ?? '',
      r.category,
      r.notes ?? '',
    ]
      .map((c) => csvEscape(String(c)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function AdminRbacRoutesPage() {
  const { isDev } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RouteRole | 'all'>('all');
  const [guardFilter, setGuardFilter] = useState<RouteGuard | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RBAC_ROUTES.filter((r) => {
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;
      if (guardFilter !== 'all' && r.guard !== guardFilter) return false;
      if (!q) return true;
      return (
        r.path.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        (r.rlsHelper ?? '').toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, roleFilter, guardFilter]);

  const summary = RBAC_SUMMARY;
  const issues = RBAC_ISSUES;

  const handleExport = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rbac-rotas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageSEO
        title="Auditoria RBAC de Rotas"
        description="Matriz de auditoria das rotas técnicas, papéis exigidos, guards e helpers RLS."
        path="/admin/rbac-rotas"
        noIndex
      />

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 data-testid="page-title-rbac-rotas" className="text-2xl font-semibold">
              Auditoria RBAC de Rotas
            </h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Fonte única auditável de quais rotas exigem qual papel, qual guard de roteamento as
            protege e qual helper RLS deve ser usado nas policies relacionadas. Atualize{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              src/lib/rbac/route-matrix.ts
            </code>{' '}
            sempre que adicionar/remover rotas técnicas.
          </p>
        </header>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total de rotas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{summary.total}</div>
            </CardContent>
          </Card>
          {(['public', 'authenticated', 'admin', 'dev'] as RouteRole[]).map((role) => (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Badge variant={ROLE_VARIANT[role]} className="px-1.5 py-0 text-[10px]">
                    {ROLE_LABEL[role]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{summary.byRole[role]}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Inconsistências */}
        {issues.length > 0 ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>
              {issues.length} inconsistência{issues.length > 1 ? 's' : ''} detectada
              {issues.length > 1 ? 's' : ''}
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertTitle>Matriz consistente</AlertTitle>
            <AlertDescription className="text-xs">
              Todas as rotas <code className="font-mono">dev</code> usam{' '}
              <code className="font-mono">DevRoute</code> + AAL2; todas as{' '}
              <code className="font-mono">admin</code> usam{' '}
              <code className="font-mono">AdminRoute</code> + AAL2.
            </AlertDescription>
          </Alert>
        )}

        {/* Filtros + export */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Matriz de acesso</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar path, label, helper..."
                    className="h-9 w-56 pl-7"
                  />
                </div>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => setRoleFilter(v as RouteRole | 'all')}
                >
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os papéis</SelectItem>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="authenticated">Autenticado</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="dev">Dev</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={guardFilter}
                  onValueChange={(v) => setGuardFilter(v as RouteGuard | 'all')}
                >
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder="Guard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os guards</SelectItem>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="ProtectedRoute">ProtectedRoute</SelectItem>
                    <SelectItem value="AdminRoute">AdminRoute</SelectItem>
                    <SelectItem value="DevRoute">DevRoute</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Rota</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Guard</TableHead>
                    <TableHead className="text-center">MFA / AAL2</TableHead>
                    <TableHead>Helper RLS sugerido</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Abrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma rota corresponde aos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.path}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{r.label}</span>
                            <code className="font-mono text-[11px] text-muted-foreground">
                              {r.path}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ROLE_VARIANT[r.role]}>{ROLE_LABEL[r.role]}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="font-mono text-xs">{r.guard}</code>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.mfaAal2 ? (
                            <span title="Exige AAL2">
                              <Lock className="inline h-4 w-4 text-primary" />
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.rlsHelper ? (
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {r.rlsHelper}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.notes ? (
                            <span className="text-xs text-muted-foreground">{r.notes}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Apenas dev pode abrir links técnicos a partir daqui */}
                          {r.path.includes(':') || r.role === 'public' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : isDev || r.role !== 'dev' ? (
                            <Button variant="ghost" size="sm" asChild className="h-8">
                              <Link to={r.path} aria-label={`Abrir ${r.label}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          ) : (
                            <span title="Requer dev">
                              <AlertTriangle className="inline h-4 w-4 text-muted-foreground" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Esta tabela é gerada a partir do SSOT em{' '}
              <code className="font-mono">src/lib/rbac/route-matrix.ts</code>. Inconsistências
              aparecem no banner acima e devem ser corrigidas antes do merge.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
