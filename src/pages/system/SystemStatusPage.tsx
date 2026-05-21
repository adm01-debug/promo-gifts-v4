import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invokeCrmDb } from "@/lib/crm-db";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Server,
  Code,
  Clock,
  Wifi,
  TableProperties,
  Download,
  ShieldCheck,
  Key,
  ShieldAlert,
  Fingerprint
} from "lucide-react";
import { PageSEO } from "@/components/seo/PageSEO";

interface StatusItem {
  name: string;
  status: "ok" | "error" | "warning" | "loading";
  message: string;
  icon: React.ReactNode;
}

interface CrmTableCheck {
  name: string;
  status: "ok" | "error" | "loading";
  rowCount?: number;
  message: string;
}

const CRM_CRITICAL_TABLES = [
  "companies",
  "contacts",
  "contact_emails",
  "contact_phones",
  "company_addresses",
  "company_social_media",
  "customers",
  "suppliers",
  "carriers",
];

export default function SystemStatusPage() {
  const { user, roles, currentAAL } = useAuth();
  const { actualTheme } = useTheme();
  const location = useLocation();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [crmTables, setCrmTables] = useState<CrmTableCheck[]>([]);
  const [rlsChecks, setRlsChecks] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingCrm, setIsCheckingCrm] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [instanceInfo, setInstanceInfo] = useState<{
    url: string;
    hasAnon: boolean;
    sessionType: string;
    jwtValid: boolean;
  }>({ url: "", hasAnon: false, sessionType: "Nenhum", jwtValid: false });

  const appVersion = "2.1.0-diagnostic";
  const buildDate = new Date().toISOString().split('T')[0];

  const runHealthCheck = async () => {
    setIsChecking(true);
    const results: StatusItem[] = [];

    // 1. Instance & Session Info
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    const { data: { session } } = await supabase.auth.getSession();
    
    setInstanceInfo({
      url: supabaseUrl,
      hasAnon: !!supabaseKey,
      sessionType: session ? `Autenticado (${session.user.app_metadata.provider || 'e-mail'})` : "Anônimo",
      jwtValid: !!session && (session.expires_at ? session.expires_at * 1000 > Date.now() : false)
    });

    // 2. Env vars Check
    results.push({
      name: "Variáveis de Ambiente",
      status: supabaseUrl && supabaseKey ? "ok" : "error",
      message: supabaseUrl && supabaseKey ? "Configuradas corretamente" : "Faltando chaves VITE_SUPABASE",
      icon: <Key className="h-5 w-5" />,
    });

    // 3. Database connection & Latency
    const start = performance.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const latency = Math.round(performance.now() - start);
      const isConnected = !error || (error.code !== 'PGRST301' && error.code !== '42P01');
      
      results.push({
        name: "Conexão com Database",
        status: error ? (isConnected ? "warning" : "error") : "ok",
        message: error 
          ? `Status: ${error.code} - ${error.message}` 
          : `Conectado em ${latency}ms`,
        icon: <Database className="h-5 w-5" />,
      });
    } catch (err) {
      results.push({
        name: "Conexão com Database",
        status: "error",
        message: "Erro fatal de rede",
        icon: <Database className="h-5 w-5" />,
      });
    }

    // 4. Detailed RLS Validation
    const criticalTables = ["profiles", "user_roles", "quotes", "products"] as const;
    const rlsResults = await Promise.all(
      criticalTables.map(async (t) => {
        const { error, count, status: httpStatus } = await supabase.from(t).select("*", { count: "exact", head: true });
        
        let status: "ok" | "error" | "warning" = "ok";
        let msg = "Acessível";
        let suggestion = "";
        
        if (error) {
          if (error.code === 'PGRST301') {
            status = "error";
            msg = `JWT Inválido/Expirado (${error.code})`;
            suggestion = "Sua sessão expirou. Tente sair e entrar novamente para renovar o token.";
          } else if (httpStatus === 403 || error.code === '42501') {
            status = "warning";
            msg = `Forbidden (Bloqueado por RLS: ${error.code})`;
            suggestion = `Verifique se existe uma política SELECT para a role '${instanceInfo.sessionType}' na tabela ${t}.`;
          } else if (error.code === '42P01') {
            status = "error";
            msg = `Tabela Inexistente (Esquema não sincronizado: ${error.code})`;
            suggestion = "Execute as migrações no banco de dados para criar a tabela.";
          } else {
            status = "error";
            msg = `Erro ${error.code}: ${error.message} (HTTP ${httpStatus})`;
            suggestion = "Verifique os logs do Supabase para mais detalhes.";
          }
        }

        return { table: t, status, msg, code: error?.code, httpStatus, suggestion };
      })
    );
    setRlsChecks(rlsResults);

    results.push({
      name: "Integridade de RLS",
      status: rlsResults.every(r => r.status === 'ok') ? "ok" : "warning",
      message: `${rlsResults.filter(r => r.status === 'ok').length}/${criticalTables.length} tabelas OK`,
      icon: <ShieldCheck className="h-5 w-5" />,
    });

    setStatuses(results);
    setLastCheck(new Date());
    setIsChecking(false);
  };

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
      statuses: statuses.map(s => ({ name: s.name, status: s.status, message: s.message })),
      rls: rlsChecks,
      recentLoginErrors: recentErrors || [],
      crm: crmTables
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostico-sistema-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsChecking(false);
  };

  const runCrmHealthCheck = async () => {
    setIsCheckingCrm(true);
    const tableResults: CrmTableCheck[] = CRM_CRITICAL_TABLES.map((t) => ({
      name: t,
      status: "loading" as const,
      message: "Verificando...",
    }));
    setCrmTables([...tableResults]);

    const batchResult = await invokeCrmDb<
      { success: boolean; results: Array<{ success: boolean; data?: { records: unknown[]; count: number }; error?: string; unavailable?: boolean; warning?: string }> }
    >({
      table: "companies", // ignored for batch
      operation: "batch",
      queries: CRM_CRITICAL_TABLES.map((t) => ({
        table: t,
        select: "id",
        limit: 1,
      })),
    });

    if (batchResult.error || !batchResult.data?.results) {
      setCrmTables(
        CRM_CRITICAL_TABLES.map((t) => ({
          name: t,
          status: "error" as const,
          message: batchResult.error || "Falha na verificação em lote",
        }))
      );
    } else {
      const updatedResults = CRM_CRITICAL_TABLES.map((t, i) => {
        const r = batchResult.data!.results[i];
        if (!r) return { name: t, status: "error" as const, message: "Sem resposta" };
        if (r.unavailable) return { name: t, status: "error" as const, message: r.warning || "Tabela ausente" };
        if (!r.success) return { name: t, status: "error" as const, message: r.error || "Erro desconhecido" };
        return {
          name: t,
          status: "ok" as const,
          rowCount: r.data?.count ?? 0,
          message: `Acessível (${r.data?.records?.length ?? 0} registro(s) de amostra)`,
        };
      });
      setCrmTables(updatedResults);
    }

    setIsCheckingCrm(false);
  };

  useEffect(() => {
    runHealthCheck();
    runCrmHealthCheck();
  }, []);

  const getStatusIcon = (status: "ok" | "error" | "warning" | "loading") => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "loading":
        return <AlertCircle className="h-5 w-5 text-warning animate-pulse" />;
    }
  };

  const getStatusBadge = (status: "ok" | "error" | "warning" | "loading") => {
    switch (status) {
      case "ok":
        return <Badge className="bg-primary/20 text-primary border-primary/30">OK</Badge>;
      case "error":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Erro</Badge>;
      case "warning":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Aviso</Badge>;
      case "loading":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Verificando</Badge>;
    }
  };

  const overallStatus = statuses.every((s) => s.status === "ok") ? "ok" : "error";
  const crmOkCount = crmTables.filter((t) => t.status === "ok").length;
  const crmErrorCount = crmTables.filter((t) => t.status === "error").length;

  return (
    <div className="min-h-screen bg-background w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
      <PageSEO title="Status do Sistema" description="Monitore a saúde e status de todos os serviços." path="/status" noIndex />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 data-testid="page-title-status" className="text-3xl font-bold font-display">Status do Sistema</h1>
          <p className="text-muted-foreground">Diagnóstico de saúde da aplicação</p>
        </div>

        {/* Overall Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className={`border-2 h-full ${overallStatus === "ok" ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5"}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                  {overallStatus === "ok" ? (
                    <CheckCircle className="h-10 w-10 text-primary" />
                  ) : (
                    <XCircle className="h-10 w-10 text-destructive" />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold font-display">
                      {overallStatus === "ok" ? "Sistema Operacional" : "Problemas Detectados"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {statuses.filter((s) => s.status === "ok").length}/{statuses.length} serviços OK
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={runHealthCheck} disabled={isChecking} variant="outline" size="sm">
                    <RefreshCw className={`h-3 w-3 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                    Verificar
                  </Button>
                  <Button onClick={downloadReport} variant="secondary" size="sm">
                    <Download className="h-3 w-3 mr-2" />
                    Relatório
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
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
                <span className={instanceInfo.sessionType.includes('Autenticado') ? "text-success font-bold" : "text-warning"}>
                  {instanceInfo.sessionType}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">JWT Válido:</span>
                <Badge variant={instanceInfo.jwtValid ? "success" : "destructive"} className="h-4 text-[9px]">
                  {instanceInfo.jwtValid ? "SIM" : "NÃO/ANON"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider & State Status */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Estado dos Providers (Context)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground font-medium">Auth Provider</span>
              <div className="flex items-center gap-2">
                <Badge variant={user ? "success" : "secondary"}>
                  {user ? "Autenticado" : "Público"}
                </Badge>
                <span className="text-[10px] font-mono opacity-60">{user?.id || 'no-session'}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground font-medium">Theme Provider</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{actualTheme}</Badge>
                <div className={`w-3 h-3 rounded-full ${actualTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} border border-white/10`} />
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground font-medium">Router Context</span>
              <div className="flex items-center gap-2 overflow-hidden max-w-[200px]">
                <Badge variant="secondary" className="font-mono text-[10px] truncate">
                  {location.pathname}
                </Badge>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground font-medium">Roles/Permissions</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {roles && roles.length > 0 ? (
                  roles.map(r => <Badge key={r} variant="outline" className="text-[9px] uppercase">{r}</Badge>)
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5" />
              Informações da Build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Versão do App</span>
              <Badge variant="secondary">{appVersion}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Data da Build</span>
              <span className="font-mono text-sm">{buildDate}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Ambiente</span>
              <Badge variant="outline">{import.meta.env.MODE}</Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">React Version</span>
              <span className="font-mono text-sm">18.3.1</span>
            </div>
          </CardContent>
        </Card>

        {/* Detailed RLS Checks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-500" />
              Detalhamento de RLS e Tabelas
            </CardTitle>
            <p className="text-xs text-muted-foreground">Validação de permissões de acesso por camada de segurança.</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {rlsChecks.map((check, i) => (
              <div key={i} className="flex flex-col py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors border-b border-white/5 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{check.table}</p>
                    <p className={`text-xs ${check.status === 'error' ? 'text-destructive' : check.status === 'warning' ? 'text-warning' : 'text-success'}`}>
                      {check.msg}
                    </p>
                  </div>
                  {check.code && (
                    <Badge variant="outline" className="font-mono text-[9px] h-5 opacity-60">
                      {check.code}
                    </Badge>
                  )}
                </div>
                {check.suggestion && (
                  <div className="mt-2 ml-11 p-2 bg-blue-500/5 rounded border border-blue-500/10">
                    <p className="text-[11px] text-blue-400 leading-relaxed italic">
                      <span className="font-bold uppercase text-[9px] mr-1">Sugestão:</span>
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              Infraestrutura de Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {statuses.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
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

        {/* CRM External Tables Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Tabelas CRM Externo
                {crmErrorCount > 0 && (
                  <Badge className="bg-destructive/20 text-destructive border-destructive/30 ml-2">
                    {crmErrorCount} ausente(s)
                  </Badge>
                )}
                {crmErrorCount === 0 && crmOkCount > 0 && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 ml-2">
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
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCheckingCrm ? "animate-spin" : ""}`} />
                Re-verificar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Verifica a disponibilidade das tabelas críticas no banco CRM externo via bridge.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {crmTables.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aguardando verificação...
              </p>
            )}
            {crmTables.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
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
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Clock className="h-4 w-4" />
            Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}
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
