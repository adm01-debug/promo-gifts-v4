import { useState, useEffect } from "react";
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
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [crmTables, setCrmTables] = useState<CrmTableCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingCrm, setIsCheckingCrm] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const appVersion = "2.0.0";
  const buildDate = "2026-01-05";

  const runHealthCheck = async () => {
    setIsChecking(true);
    const results: StatusItem[] = [];

    // 1. Frontend Build
    results.push({
      name: "Frontend Build",
      status: "ok",
      message: "React app carregado com sucesso",
      icon: <Code className="h-5 w-5" />,
    });

    // 2. Env vars
    const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
    const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    results.push({
      name: "Variáveis de Ambiente",
      status: hasSupabaseUrl && hasSupabaseKey ? "ok" : "error",
      message:
        hasSupabaseUrl && hasSupabaseKey
          ? "Configuradas corretamente"
          : `Faltando: ${!hasSupabaseUrl ? "SUPABASE_URL " : ""}${!hasSupabaseKey ? "SUPABASE_KEY" : ""}`,
      icon: <Server className="h-5 w-5" />,
    });

    // 3. Database connection
    try {
      const { data, error } = await supabase.from("profiles").select("id, email, role, is_active").limit(1);
      const isConnected = !error || (error.code !== 'PGRST301' && error.code !== '42P01');
      
      results.push({
        name: "Conexão com Database",
        status: error ? (isConnected ? "warning" : "error") : "ok",
        message: error 
          ? `Status: ${error.code} - ${error.message}` 
          : `Conectado com sucesso (Instância: ${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]})`,
        icon: <Database className="h-5 w-5" />,
      });

      if (error) {
        console.error("Database connection check detail:", error);
      }
    } catch (err) {
      results.push({
        name: "Conexão com Database",
        status: "error",
        message: err instanceof Error ? err.message : "Erro fatal de conexão",
        icon: <Database className="h-5 w-5" />,
      });
    }

    // 4. Auth service
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      results.push({
        name: "Serviço de Autenticação",
        status: "ok",
        message: session ? "Usuário logado" : "Serviço disponível (não autenticado)",
        icon: <Wifi className="h-5 w-5" />,
      });
    } catch (err) {
      results.push({
        name: "Serviço de Autenticação",
        status: "error",
        message: err instanceof Error ? err.message : "Erro no auth",
        icon: <Wifi className="h-5 w-5" />,
      });
    }

    // 5. Network
    results.push({
      name: "Conexão de Rede",
      status: navigator.onLine ? "ok" : "error",
      message: navigator.onLine ? "Online" : "Offline",
      icon: <Wifi className="h-5 w-5" />,
    });

    // 6. Tables & RLS Validation
    try {
      const criticalTables = ["profiles", "user_roles", "quotes", "products"] as const;
      const checks = await Promise.all(
        criticalTables.map(async (t) => {
          const { error, count } = await supabase.from(t).select("*", { count: "exact", head: true });
          // Se erro for 403 (Forbidden) ou PGRST301 (JWT expired/invalid), pode ser RLS ou Auth
          // Se erro for 42P01, a tabela não existe
          return { 
            table: t, 
            ok: !error || error.code === 'PGRST301', 
            msg: error?.message,
            code: error?.code,
            count 
          };
        })
      );
      
      const failed = checks.filter((c) => !c.ok && c.code === '42P01');
      const rlsBlocked = checks.filter((c) => !c.ok && c.code === 'PGRST301');

      results.push({
        name: "Validação de Tabelas",
        status: failed.length > 0 ? "error" : (rlsBlocked.length > 0 ? "warning" : "ok"),
        message: failed.length > 0 
          ? `Tabelas ausentes: ${failed.map(f => f.table).join(", ")}`
          : `Tabelas críticas mapeadas e acessíveis.`,
        icon: <TableProperties className="h-5 w-5" />,
      });
    } catch {
      results.push({
        name: "Validação de Tabelas",
        status: "error",
        message: "Falha crítica na verificação de esquema",
        icon: <TableProperties className="h-5 w-5" />,
      });
    }

    setStatuses(results);
    setLastCheck(new Date());
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
          <h1 className="text-3xl font-bold font-display">Status do Sistema</h1>
          <p className="text-muted-foreground">Diagnóstico de saúde da aplicação</p>
        </div>

        {/* Overall Status */}
        <Card
          className={`border-2 ${overallStatus === "ok" ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5"}`}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
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
                    {statuses.filter((s) => s.status === "ok").length}/{statuses.length} serviços funcionando
                  </p>
                </div>
              </div>
              <Button onClick={runHealthCheck} disabled={isChecking} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                Verificar
              </Button>
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

        {/* Status Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              Status dos Serviços
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
