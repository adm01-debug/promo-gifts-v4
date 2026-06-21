/**
 * OwnershipAuditAdminPage — exibe o histórico de relatórios de auditoria
 * de propriedade de registros (vendedor/usuário/criador) e permite
 * disparar uma nova varredura sob demanda.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  RefreshCw,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  FileText,
} from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageSEO } from '@/components/seo/PageSEO';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { RlsIntegrationTestsDialog } from '@/components/admin/RlsIntegrationTestsDialog';
import { OwnershipRepairDialog } from '@/components/admin/OwnershipRepairDialog';

import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';
import { cn } from '@/lib/utils';
interface ReportDetail {
  table: string;
  owner_column: string;
  null_owner_count: number;
  missing_user_count: number;
}

type RlsSeverity = 'critical' | 'high' | 'medium' | 'ok';
interface RlsCoverageEntry {
  table: string;
  rls_enabled: boolean;
  policy_count: number;
  has_select: boolean;
  has_insert: boolean;
  has_update: boolean;
  has_delete: boolean;
  missing_ops: Array<'DELETE' | 'INSERT' | 'SELECT' | 'UPDATE'>;
  severity: RlsSeverity;
}

interface ReportRow {
  id: string;
  generated_at: string;
  total_tables_scanned: number;
  total_issues_found: number;
  null_owner_count: number;
  missing_user_count: number;
  details: ReportDetail[];
  triggered_by: string;
  duration_ms: number | null;
  rls_coverage: RlsCoverageEntry[];
  rls_gaps_count: number;
}

export default function OwnershipAuditAdminPage() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['ownership-audit-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ownership_audit_reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
  });

  const current = reports.find((r) => r.id === selected) ?? reports[0];

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ownership-audit', {
        body: { triggered_by: 'manual_admin' },
      });
      if (error) throw error;
      toast.success(
        `Auditoria concluída: ${data?.summary?.total_tables_scanned ?? 0} tabelas, ` +
          `${data?.summary?.total_issues_found ?? 0} problemas.`,
      );
      await qc.invalidateQueries({ queryKey: ['ownership-audit-reports'] });
    } catch (e) {
      logger.error('Ownership audit run failed', e);
      toast.error(`Falha ao executar auditoria: ${toErrorMessage(e)}`);
    } finally {
      setRunning(false);
    }
  }

  async function exportMatrix(exportFormat: 'csv' | 'pdf') {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error('Sessão expirada — faça login novamente.');
        return;
      }
      const url = `${SUPABASE_URL}/functions/v1/rls-matrix-export?format=${exportFormat}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (exportFormat === 'pdf') {
        // HTML printável → abre em nova aba para Imprimir → Salvar como PDF
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `rls-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      }
      toast.success(`Matriz RLS exportada (${exportFormat.toUpperCase()}).`);
    } catch (e) {
      logger.error('RLS matrix export failed', e);
      toast.error(`Falha ao exportar matriz: ${toErrorMessage(e)}`);
    }
  }

  return (
    <>
      <PageSEO
        title="Auditoria de Propriedade"
        description="Auditoria periódica de registros órfãos e sem dono."
        path="/admin/auditoria-propriedade"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1
              data-testid="page-title-ownership-audit"
              className="flex items-center gap-2 text-2xl font-bold"
            >
              <ShieldAlert className="h-6 w-6 text-primary" />
              Auditoria de Propriedade de Registros
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Detecta registros sem dono ou cujo dono não existe mais. Roda automaticamente todos os
              dias.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RlsIntegrationTestsDialog />
            <OwnershipRepairDialog
              reportId={current?.id}
              hasIssues={(current?.total_issues_found ?? 0) > 0}
            />
            <Button variant="outline" onClick={() => exportMatrix('csv')} className="gap-2">
              <Download className="h-4 w-4" /> Matriz CSV
            </Button>
            <Button variant="outline" onClick={() => exportMatrix('pdf')} className="gap-2">
              <FileText className="h-4 w-4" /> Matriz PDF
            </Button>
            <Button onClick={runNow} disabled={running} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', running && 'animate-spin')} />
              Rodar agora
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Database className="h-3.5 w-3.5" /> Tabelas escaneadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{current?.total_tables_scanned ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Problemas encontrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${current && current.total_issues_found > 0 ? 'text-destructive' : 'text-success'}`}
              >
                {current?.total_issues_found ?? '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {current?.null_owner_count ?? 0} nulos · {current?.missing_user_count ?? 0} órfãos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Última execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">
                {current
                  ? format(new Date(current.generated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {current?.triggered_by ?? '—'} · {current?.duration_ms ?? 0} ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Lacunas RLS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${current && current.rls_gaps_count > 0 ? 'text-destructive' : 'text-success'}`}
              >
                {current?.rls_gaps_count ?? '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Array.isArray(current?.rls_coverage) ? current?.rls_coverage.length : 0} tabelas
                afetadas
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes do relatório selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            {!current || current.details.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Nenhum problema detectado nesta varredura.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Coluna de dono</TableHead>
                    <TableHead className="text-right">Nulos</TableHead>
                    <TableHead className="text-right">Órfãos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.details.map((d) => (
                    <TableRow key={`${d.table}.${d.owner_column}`}>
                      <TableCell className="font-mono text-xs">{d.table}</TableCell>
                      <TableCell className="font-mono text-xs">{d.owner_column}</TableCell>
                      <TableCell className="text-right">
                        {d.null_owner_count > 0 ? (
                          <Badge variant="destructive">{d.null_owner_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.missing_user_count > 0 ? (
                          <Badge variant="destructive">{d.missing_user_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" />
              Cobertura RLS — tabelas críticas sem política por operação
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Lista as tabelas que possuem coluna de dono (seller_id, user_id, owner_id, created_by,
              assigned_to) e que <strong>não têm política RLS</strong> para uma ou mais operações.
              Cada lacuna significa que a operação só funciona via service_role / cron — usuários
              autenticados ficam bloqueados ou, pior, expostos se o RLS estiver desabilitado.
            </p>
          </CardHeader>
          <CardContent>
            {!current ||
            !Array.isArray(current.rls_coverage) ||
            current.rls_coverage.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Todas as tabelas críticas possuem políticas RLS para SELECT, INSERT, UPDATE e
                DELETE.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-center">RLS</TableHead>
                    <TableHead className="text-center">Políticas</TableHead>
                    <TableHead>Operações sem política</TableHead>
                    <TableHead className="text-right">Severidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.rls_coverage.map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="font-mono text-xs">{r.table}</TableCell>
                      <TableCell className="text-center">
                        {r.rls_enabled ? (
                          <Badge variant="secondary" className="text-[10px]">
                            ON
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            OFF
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">{r.policy_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.missing_ops.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            r.missing_ops.map((op) => (
                              <Badge
                                key={op}
                                variant={op === 'SELECT' ? 'destructive' : 'outline'}
                                className="font-mono text-[10px]"
                              >
                                {op}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            r.severity === 'critical' || r.severity === 'high'
                              ? 'destructive'
                              : r.severity === 'medium'
                                ? 'outline'
                                : 'secondary'
                          }
                          className="text-[10px] uppercase"
                        >
                          {r.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico (últimas 50 execuções)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-4 text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Tabelas</TableHead>
                    <TableHead className="text-right">Problemas</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${current?.id === r.id ? 'bg-secondary/40' : ''}`}
                      onClick={() => setSelected(r.id)}
                    >
                      <TableCell className="text-xs">
                        {format(new Date(r.generated_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.triggered_by}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.total_tables_scanned}</TableCell>
                      <TableCell className="text-right">
                        {r.total_issues_found > 0 ? (
                          <Badge variant="destructive">{r.total_issues_found}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.duration_ms ?? 0} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
