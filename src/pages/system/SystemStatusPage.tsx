import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { invokeCrmBatch, type CrmBatchResult } from '@/lib/crm-db';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Server,
  Code,
  Clock,
  TableProperties,
  Download,
  ShieldCheck,
  Key,
  ShieldAlert,
  Fingerprint,
} from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { MedallionPipelineCard } from '@/components/system/MedallionPipelineCard';
import { cn } from '@/lib/utils';

interface StatusItem {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'loading';
  message: string;
  icon: React.ReactNode;
}

interface CrmTableCheck {
  name: string;
  status: 'ok' | 'error' | 'loading';
  rowCount?: number;
  message: string;
}

interface RlsCheck {
  table: string;
  status: 'ok' | 'error' | 'warning';
  msg: string;
  code?: string;
  httpStatus: number;
  suggestion: string;
}

const CRM_CRITICAL_TABLES = [
  'companies',
  'contacts',
  'contact_emails',
  'contact_phones',
  'company_addresses',
  'company_social_media',
  'customers',
  'suppliers',
  'carriers',
];

export default function SystemStatusPage() {
  const { user, roles } = useAuth();
  const { actualTheme } = useTheme();
  const location = useLocation();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [crmTables, setCrmTables] = useState<CrmTableCheck[]>([]);
  const [rlsChecks, setRlsChecks] = useState<RlsCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingCrm, setIsCheckingCrm] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [instanceInfo, setInstanceInfo] = useState<{
    url: string;
    hasAnon: boolean;
    sessionType: string;
    jwtValid: boolean;
  }>({ url: '', hasAnon: false, sessionType: 'Nenhum', jwtValid: false });

  const appVersion = '2.1.0-diagnostic';
  const buildDate = new Date().toISOString().split('T')[0];

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    const results: StatusItem[] = [];

    // 1. Instance & Session Info
    const supabaseUrl = SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionType = session
      ? `Autenticado (${session.user.app_metadata.provider || 'e-mail'})`
      : 'Anônimo';
    const jwtValid =
      !!session && (session.expires_at ? session.expires_at * 1000 > Date.now() : false);

    setInstanceInfo({
      url: supabaseUrl,
      hasAnon: !!supabaseKey,
      sessionType,
      jwtValid,
    });

    // 2. Env vars Check
    results.push({
      name: 'Variáveis de Ambiente',
      status: supabaseUrl && supabaseKey ? 'ok' : 'error',
      message:
        supabaseUrl && supabaseKey ? 'Configuradas corretamente' : 'Faltando chaves VITE_SUPABASE',
      icon: <Key className="h-5 w-5" />,
    });

    // 3. Database connection & Latency
    const start = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const latency = Math.round(performance.now() - start);
      const isConnected = !error || (error.code !== 'PGRST301' && error.code !== '42P01');

      results.push({
        name: 'Conexão com Database',
        status: error ? (isConnected ? 'warning' : 'error') : 'ok',
        message: error ? `Status: ${error.code} - ${error.message}` : `Conectado em ${latency}ms`,
        icon: <Database className="h-5 w-5" />,
      });
    } catch {
      results.push({
        name: 'Conexão com Database',
        status: 'error',
        message: 'Erro fatal de rede',
        icon: <Database className="h-5 w-5" />,
      });
    }

    // 4. Detailed RLS Validation
    const criticalTables = ['profiles', 'user_roles', 'quotes', 'products'] as const;
    const rlsResults = await Promise.all(
      criticalTables.map(async (t) => {
        const { error, status: httpStatus } = await supabase
          .from(t)
          .select('*', { count: 'exact', head: true });

        let status: 'ok' | 'error' | 'warning' = 'ok';
        let msg = 'Acessível';
        let suggestion = '';

        if (error) {
          if (error.code === 'PGRST301') {
            status = 'error';
            msg = `JWT Inválido/Expirado (${error.code})`;
            suggestion = 'Sua sessão expirou. Tente sair e entrar novamente para renovar o token.';
          } else if (httpStatus === 403 || error.code === '42501') {
            status = 'warning';
            msg = `Forbidden (Bloqueado por RLS: ${error.code})`;
            suggestion = `Verifique se existe uma política SELECT para a role '${sessionType}' na tabela ${t}.`;
          } else if (error.code === '42P01') {
            status = 'error';
            msg = `Tabela Inexistente (Esquema não sincronizado: ${error.code})`;
            suggestion = 'Execute as migrações no banco de dados para criar a tabela.';
          } else {
            status = 'error';
            msg = `Erro ${error.code}: ${error.message} (HTTP ${httpStatus})`;
            suggestion = 'Verifique os logs do Supabase para mais detalhes.';
          }
        }

        return { table: t, status, msg, code: error?.code, httpStatus, suggestion };
      }),
    );
    setRlsChecks(rlsResults);

    results.push({
      name: 'Integridade de RLS',
      status: rlsResults.every((r) => r.status === 'ok') ? 'ok' : 'warning',
      message: `${rlsResults.filter((r) => r.status === 'ok').length}/${criticalTables.length} tabelas OK`,
      icon: <ShieldCheck className="h-5 w-5" />,
    });

    setStatuses(results);
    setLastCheck(new Date());
    setIsChecking(false);
  }, []);

  const downloadReport = async () => {
    setIsChecking(true);

    // Buscar erros de login recentes (últimas 24h) para incluir no relatório
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentErrors } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('success', false)
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(20);

    const report = {
      timestamp: new Date().toISOString(),
      instance: instanceInfo,
      statuses: statuses.map((s) => ({ name: s.name, status: s.status, message: s.message })),
      rls: rlsChecks,
      recentLoginErrors: recentErrors || [],
      crm: crmTables,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostico-sistema-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsChecking(false);
  };

  const runCrmHealthCheck = useCallback(async () => {
    setIsCheckingCrm(true);
    const tableResults: CrmTableCheck[] = CRM_CRITICAL_TABLES.map((t) => ({
      name: t,
      status: 'loading' as const,
      message: 'Verificando...',
    }));
    setCrmTables([...tableResults]);

    let batchResults: CrmBatchResult[] | null = null;
    try {
      batchResults = await invokeCrmBatch(
        CRM_CRITICAL_TABLES.map((t) => ({
          table: t,
          select: 'id',
          limit: 1,
        })),
      );
    } catch (err) {
      setCrmTables(
        CRM_CRITICAL_TABLES.map((t) => ({
          name: t,
          status: 'error' as const,
          message: err instanceof Error ? err.message : 'Falha na verificação em lote',
        })),
      );
      batchResults = null;
    }

    if (batchResults) {
      const updatedResults = CRM_CRITICAL_TABLES.map((t, i) => {
        const r = batchResults[i];
        if (!r) return { name: t, status: 'error' as const, message: 'Sem resposta' };
        if (r.unavailable)
          return { name: t, status: 'error' as const, message: r.warning || 'Tabela ausente' };
        if (!r.success)
          return { name: t, status: 'error' as const, message: r.error || 'Erro desconhecido' };
        return {
          name: t,
          status: 'ok' as const,
          rowCount: r.data?.count ?? 0,
          message: `Acessível (${r.data?.records?.length ?? 0} registro(s) de amostra)`,
        };
      });
      setCrmTables(updatedResults);
    }

    setIsCheckingCrm(false);
  }, []);

  useEffect(() => {
    runHealthCheck();
    runCrmHealthCheck();
  }, [runCrmHealthCheck, runHealthCheck]);

  const getStatusIcon = (status: 'ok' | 'error' | 'warning' | 'loading') => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'loading':
        return <AlertCircle className="h-5 w-5 animate-pulse text-warning" />;
    }
  };

  const getStatusBadge = (status: 'ok' | 'error' | 'warning' | 'loading') => {
    switch (status) {
      case 'ok':
        return <Badge className="border-primary/30 bg-primary/20 text-primary">OK</Badge>;
      case 'error':
        return (
          <Badge className="border-destructive/30 bg-destructive/20 text-destructive">Erro</Badge>
        );
      case 'warning':
        return <Badge className="border-warning/30 bg-warning/20 text-warning">Aviso</Badge>;
      case 'loading':
        return <Badge className="border-warning/30 bg-warning/20 text-warning">Verificando</Badge>;
    }
  };

  const overallStatus = useMemo(
    () => (statuses.every((s) => s.status === 'ok') ? 'ok' : 'error'),
    [statuses],
  );
  const crmOkCount = useMemo(() => crmTables.filter((t) => t.status === 'ok').length, [crmTables]);
  const crmErrorCount = useMemo(
    () => crmTables.filter((t) => t.status === 'error').length,
    [crmTables],
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1920px] animate-fade-in space-y-3 bg-background px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      <PageSEO
        title="Status do Sistema"
        description="Monitore a saúde e status de todos os serviços."
        path="/admin/status"
        noIndex
      />
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 data-testid="page-title-status" className="font-display text-3xl font-bold">
            Status do Sistema
          </h1>
          <p className="text-muted-foreground">Diagnóstico de saúde da aplicação</p>
        </div>

        {/* Overall Status */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card
            className={cn(
              'h-full border-2',
              overallStatus === 'ok'
                ? 'border-primary/50 bg-primary/5'
                : 'border-destructive/50 bg-destructive/5',
            )}
          >
            <CardContent className="p-6">
              <div className="flex h-full items-center justify-between">
                <div className="flex items-center gap-4">
                  {overallStatus === 'ok' ? (
                    <CheckCircle className="h-10 w-10 text-primary" />
                  ) : (
                    <XCircle className="h-10 w-10 text-destructive" />
                  )}
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      {overallStatus === 'ok' ? 'Sistema Operacional' : 'Problemas Detectados'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {statuses.filter((s) => s.status === 'ok').length}/{statuses.length} serviços
                      OK
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={runHealthCheck}
                    disabled={isChecking}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className={cn('mr-2 h-3 w-3', isChecking && 'animate-spin')} />
                    Verificar
                  </Button>
                  <Button onClick={downloadReport} variant="secondary" size="sm">
                    <Download className="mr-2 h-3 w-3" />
                    Relatório
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/60">
                <Fingerprint className="h-4 w-4" /> Instância Supabase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">URL:</span>
                <span className="font-mono text-white/80">{instanceInfo.url.split('//')[1]}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Sessão:</span>
                <span
                  className={
                    instanceInfo.sessionType.includes('Autenticado')
                      ? 'font-bold text-success'
                      : 'text-warning'
                  }
                >
                  {instanceInfo.sessionType}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">JWT Válido:</span>
                <Badge
                  variant={instanceInfo.jwtValid ? 'success' : 'destructive'}
                  className="h-4 text-[9px]"
                >
                  {instanceInfo.jwtValid ? 'SIM' : 'NÃO/ANON'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider & State Status */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Estado dos Providers (Context)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="font-medium text-muted-foreground">Auth Provider</span>
              <div className="flex items-center gap-2">
                <Badge variant={user ? 'success' : 'secondary'}>
                  {user ? 'Autenticado' : 'Público'}
                </Badge>
                <span className="font-mono text-[10px] opacity-60">{user?.id || 'no-session'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="font-medium text-muted-foreground">Theme Provider</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {actualTheme}
                </Badge>
                <div
                  className={`h-3 w-3 rounded-full ${actualTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} border border-white/10`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="font-medium text-muted-foreground">Router Context</span>
              <div className="flex max-w-[200px] items-center gap-2 overflow-hidden">
                <Badge variant="secondary" className="truncate font-mono text-[10px]">
                  {location.pathname}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-medium text-muted-foreground">Roles/Permissions</span>
              <div className="flex flex-wrap justify-end gap-1">
                {roles && roles.length > 0 ? (
                  roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-[9px] uppercase">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs italic text-muted-foreground">Nenhuma role</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code className="h-5 w-5" />
              Informações da Build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">Versão do App</span>
              <Badge variant="secondary">{appVersion}</Badge>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">Data da Build</span>
              <span className="font-mono text-sm">{buildDate}</span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">Ambiente</span>
              <Badge variant="outline">{import.meta.env.MODE}</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">React Version</span>
              <span className="font-mono text-sm">18.3.1</span>
            </div>
          </CardContent>
        </Card>

        {/* Detailed RLS Checks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-blue-500" />
              Detalhamento de RLS e Tabelas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Validação de permissões de acesso por camada de segurança.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {rlsChecks.map((check, i) => (
              <div
                key={i}
                className="flex flex-col rounded-lg border-b border-white/5 px-2 py-3 transition-colors last:border-0 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{check.table}</p>
                    <p
                      className={cn(
                        'text-xs',
                        check.status === 'error'
                          ? 'text-destructive'
                          : check.status === 'warning'
                            ? 'text-warning'
                            : 'text-success',
                      )}
                    >
                      {check.msg}
                    </p>
                  </div>
                  {check.code && (
                    <Badge variant="outline" className="h-5 font-mono text-[9px] opacity-60">
                      {check.code}
                    </Badge>
                  )}
                </div>
                {check.suggestion && (
                  <div className="ml-11 mt-2 rounded border border-blue-500/10 bg-blue-500/5 p-2">
                    <p className="text-[11px] italic leading-relaxed text-blue-400">
                      <span className="mr-1 text-[9px] font-bold uppercase">Sugestão:</span>
                      {check.suggestion}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Status Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              Infraestrutura de Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {statuses.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">{item.icon}</div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(item.status)}
                  {getStatusIcon(item.status)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pipeline Medallion (Bronze → Prata → Ouro) */}
        <MedallionPipelineCard />

        {/* CRM External Tables Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Tabelas CRM Externo
                {crmErrorCount > 0 && (
                  <Badge className="ml-2 border-destructive/30 bg-destructive/20 text-destructive">
                    {crmErrorCount} ausente(s)
                  </Badge>
                )}
                {crmErrorCount === 0 && crmOkCount > 0 && (
                  <Badge className="ml-2 border-primary/30 bg-primary/20 text-primary">
                    {crmOkCount}/{CRM_CRITICAL_TABLES.length} OK
                  </Badge>
                )}
              </CardTitle>
              <Button
                onClick={runCrmHealthCheck}
                disabled={isCheckingCrm}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isCheckingCrm && 'animate-spin')} />
                Re-verificar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Verifica a disponibilidade das tabelas críticas no banco CRM externo via bridge.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {crmTables.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aguardando verificação...
              </p>
            )}
            {crmTables.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <TableProperties className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-mono text-sm font-medium">{table.name}</p>
                    <p className="text-xs text-muted-foreground">{table.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(table.status)}
                  {getStatusIcon(table.status)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Last Check */}
        {lastCheck && (
          <div className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
          </div>
        )}

        {/* Back Button */}
        <div className="text-center">
          <Button variant="ghost" onClick={() => window.history.back()}>
            ← Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
