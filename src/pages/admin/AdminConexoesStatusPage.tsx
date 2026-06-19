import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ExternalConnectionsSyncLogPanel } from '@/components/admin/connections/ExternalConnectionsSyncLogPanel';
import { supabase } from '@/integrations/supabase/client';

const REQUIRED_SECRETS_BY_ENV: Record<string, string[]> = {
  promobrind: [
    'EXTERNAL_PROMOBRIND_URL',
    'EXTERNAL_PROMOBRIND_ANON_KEY',
    'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
  ],
  crm: ['EXTERNAL_CRM_URL', 'EXTERNAL_CRM_ANON_KEY', 'EXTERNAL_CRM_SERVICE_ROLE_KEY'],
};

interface ConnectionRow {
  id: string;
  type: string;
  name: string;
  env_key: string | null;
  status: string;
  secret_refs: string[] | null;
  updated_at: string;
}

interface CredentialRow {
  secret_name: string;
  length: number | null;
  updated_at: string;
}

interface Diagnosis {
  envKey: string;
  connection: ConnectionRow | null;
  missing: string[];
  empty: string[];
  ok: boolean;
  reason: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function AdminConexoesStatusPage() {
  const [conns, setConns] = useState<ConnectionRow[] | null>(null);
  const [creds, setCreds] = useState<CredentialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: connData, error: connErr }, { data: credData, error: credErr }] =
      await Promise.all([
        supabase
          .from('external_connections')
          .select('id, type, name, env_key, status, secret_refs, updated_at')
          .order('env_key', { ascending: true }),
        supabase
          .from('integration_credentials')
          .select('secret_name, length, updated_at')
          .like('secret_name', 'EXTERNAL_%'),
      ]);

    if (connErr || credErr) {
      setError(connErr?.message ?? credErr?.message ?? 'Falha ao ler dados');
    } else {
      setConns(connData ?? []);
      setCreds(credData ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const diagnoses = useMemo<Diagnosis[]>(() => {
    if (!creds) return [];
    const credByName = new Map(creds.map((c) => [c.secret_name, c]));
    return Object.entries(REQUIRED_SECRETS_BY_ENV).map(([envKey, required]) => {
      const conn = conns?.find((c) => c.env_key === envKey && c.type === 'supabase') ?? null;
      const missing: string[] = [];
      const empty: string[] = [];
      for (const name of required) {
        const row = credByName.get(name);
        if (!row) missing.push(name);
        else if (!row.length || row.length === 0) empty.push(name);
      }
      const hasCriticals =
        !missing.includes(`EXTERNAL_${envKey.toUpperCase()}_URL`) &&
        !missing.includes(`EXTERNAL_${envKey.toUpperCase()}_SERVICE_ROLE_KEY`) &&
        !empty.includes(`EXTERNAL_${envKey.toUpperCase()}_URL`) &&
        !empty.includes(`EXTERNAL_${envKey.toUpperCase()}_SERVICE_ROLE_KEY`);
      let reason = 'Tudo configurado';
      if (!conn) reason = 'Conexão não foi criada — gatilho não disparou após salvar credenciais.';
      else if (missing.length > 0) reason = `Credencial(is) faltando: ${missing.join(', ')}`;
      else if (empty.length > 0) reason = `Credencial(is) com valor vazio: ${empty.join(', ')}`;
      else if (conn.status !== 'active') reason = `Status atual: ${conn.status} (esperado active)`;
      return {
        envKey,
        connection: conn,
        missing,
        empty,
        ok:
          !!conn &&
          missing.length === 0 &&
          empty.length === 0 &&
          conn.status === 'active' &&
          hasCriticals,
        reason,
      };
    });
  }, [conns, creds]);

  return (
    <>
      <PageSEO
        title="Status da sincronização de conexões | Promo Gifts"
        description="Histórico recente da sincronização de external_connections e diagnóstico de credenciais."
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/admin/conexoes">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para Conexões
              </Link>
            </Button>
            <h1
              data-testid="page-title-conexoes-status"
              className="font-display text-2xl font-semibold"
            >
              Status da sincronização
            </h1>
            <p className="text-sm text-muted-foreground">
              Histórico recente e diagnóstico da sincronização entre{' '}
              <code>integration_credentials</code> e <code>external_connections</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>

        <Separator />

        {/* Diagnóstico por ambiente */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Diagnóstico por ambiente
          </h2>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Falha ao carregar diagnóstico</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {loading && !conns
              ? [0, 1].map((i) => <Skeleton key={i} className="h-44 w-full" />)
              : diagnoses.map((d) => (
                  <Card key={d.envKey} className={d.ok ? '' : 'border-destructive/40'}>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        {d.envKey}
                      </CardTitle>
                      {d.ok ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-green-500/40 text-green-600 dark:text-green-400"
                        >
                          <CheckCircle2 className="h-3 w-3" /> ok
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-destructive/40 text-destructive"
                        >
                          <AlertTriangle className="h-3 w-3" /> falha
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-muted-foreground">Nome</div>
                          <div className="font-medium">{d.connection?.name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Status atual</div>
                          <div className="font-medium">{d.connection?.status ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Última atualização</div>
                          <div className="font-medium">{fmt(d.connection?.updated_at ?? null)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Refs de segredo</div>
                          <div className="font-medium tabular-nums">
                            {d.connection?.secret_refs?.length ?? 0}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-muted-foreground">Credenciais esperadas</div>
                        <ul className="space-y-1">
                          {REQUIRED_SECRETS_BY_ENV[d.envKey].map((name) => {
                            const row = creds?.find((c) => c.secret_name === name);
                            const isMissing = d.missing.includes(name);
                            const isEmpty = d.empty.includes(name);
                            const tone = isMissing
                              ? 'text-destructive'
                              : isEmpty
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-green-600 dark:text-green-400';
                            const label = isMissing
                              ? 'ausente'
                              : isEmpty
                                ? 'vazia'
                                : `${row?.length ?? 0} chars`;
                            return (
                              <li key={name} className="flex items-center justify-between gap-2">
                                <code className="font-mono text-[10px]">{name}</code>
                                <span className={tone}>{label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <Alert variant={d.ok ? 'default' : 'destructive'} className="py-2">
                        <AlertDescription className="text-xs">{d.reason}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>

        <Separator />

        {/* Histórico de execuções */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Histórico de execuções</h2>
          <ExternalConnectionsSyncLogPanel />
        </section>
      </div>
    </>
  );
}
