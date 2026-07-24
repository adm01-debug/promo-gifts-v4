import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, ExternalLink, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { resolveSupabaseConnectionStatus } from './connectionStatus';
import { CardSourceDiagnostic } from './CardSourceDiagnostic';
import { SecretField } from './SecretField';
import { useSecretsManager } from '@/hooks/admin';
import { useConnectionTester } from '@/hooks/intelligence';
import { ConnectionTimelineDrawer } from './ConnectionTimelineDrawer';
import { LastTestLine, type LastTestInfo } from './LastTestLine';
import { ConnectionTestHistoryPanel } from './ConnectionTestHistoryPanel';
import { RetestButton } from './RetestButton';
import { ConnectionTestDetailsDialog } from './ConnectionTestDetailsDialog';
import { RefreshFromDbButton } from './RefreshFromDbButton';
import { hasSuspiciousLength, getPreflightIssues } from './secretValidators';
import { ConnectionPreflightAlert } from './ConnectionPreflightAlert';
import { TestProgressIndicator, type TestProgressPhase } from './TestProgressIndicator';
import { RetestCooldownSelector } from './RetestCooldownSelector';
import { ConnectionDetailsDialog } from './ConnectionDetailsDialog';

const ENVS = [
  {
    key: 'local',
    name: 'Lovable Cloud (Local)',
    readOnly: true,
    envKey: null,
    urlSecret: null,
    anonSecret: null,
    serviceSecret: null,
    description: 'Banco principal do sistema. Gerenciado automaticamente pelo Lovable.',
  },
  {
    key: 'promobrind',
    name: 'Catálogo Promobrind',
    readOnly: false,
    envKey: 'promobrind' as const,
    urlSecret: 'EXTERNAL_PROMOBRIND_URL',
    anonSecret: 'EXTERNAL_PROMOBRIND_ANON_KEY',
    serviceSecret: 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
    description: 'Banco SSOT de produtos, fornecedores e categorias.',
  },
  {
    key: 'crm',
    name: 'CRM Promobrind',
    readOnly: false,
    envKey: 'crm' as const,
    urlSecret: 'EXTERNAL_CRM_URL',
    anonSecret: 'EXTERNAL_CRM_ANON_KEY',
    serviceSecret: 'EXTERNAL_CRM_SERVICE_ROLE_KEY',
    description: 'Banco do CRM externo (empresas, contatos, agendas).',
  },
] as const;

type SupabaseEnv = (typeof ENVS)[number];
type ManagedSupabaseEnv = Extract<SupabaseEnv, { readOnly: false }>;

function isManagedSupabaseEnv(env: SupabaseEnv): env is ManagedSupabaseEnv {
  return !env.readOnly;
}

export function SupabaseConnectionsTab() {
  const { secrets, list, listError } = useSecretsManager();
  const { test, isTesting, fetchLastTest } = useConnectionTester();
  const [lastByEnv, setLastByEnv] = useState<Record<string, LastTestInfo | null>>({});
  const [historyKeyByEnv, setHistoryKeyByEnv] = useState<Record<string, number>>({});
  const [detailsDialogByEnv, setDetailsDialogByEnv] = useState<Record<string, boolean>>({});
  const [phaseByEnv, setPhaseByEnv] = useState<Record<string, TestProgressPhase>>({});
  const [pendingByEnv, setPendingByEnv] = useState<Record<string, string | null>>({});
  const [timelineOpenByEnv, setTimelineOpenByEnv] = useState<Record<string, boolean>>({});
  const [overviewOpenByEnv, setOverviewOpenByEnv] = useState<Record<string, boolean>>({});

  useEffect(() => {
    list();
  }, [list]);

  const hydrate = useCallback(async () => {
    const entries = await Promise.all(
      ENVS.filter(isManagedSupabaseEnv).map(async (e) => {
        const last = await fetchLastTest('supabase', { env_key: e.envKey });
        return [
          e.key,
          last
            ? ({
                ok: last.ok,
                tested_at: last.tested_at,
                latency_ms: last.latency_ms,
                message: last.message,
              } as LastTestInfo)
            : null,
        ] as const;
      }),
    );
    setLastByEnv(Object.fromEntries(entries));
  }, [fetchLastTest]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const get = (n: string) => secrets.find((s) => s.name === n);

  const handleTest = async (envKey: 'crm' | 'promobrind', localKey: string) => {
    setPhaseByEnv((cur) => ({ ...cur, [localKey]: 'running' }));
    setPendingByEnv((cur) => ({ ...cur, [localKey]: new Date().toISOString() }));
    const r = await test('supabase', { env_key: envKey });
    setLastByEnv((cur) => ({
      ...cur,
      [localKey]: {
        ok: r.ok,
        tested_at: r.tested_at ?? new Date().toISOString(),
        latency_ms: r.latency_ms,
        message: r.error ?? r.message,
        status: r.status,
        error_kind: r.error_kind ?? null,
      },
    }));
    setHistoryKeyByEnv((cur) => ({ ...cur, [localKey]: (cur[localKey] ?? 0) + 1 }));
    setPendingByEnv((cur) => ({ ...cur, [localKey]: null }));
    setPhaseByEnv((cur) => ({ ...cur, [localKey]: r.ok ? 'completed' : 'failed' }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {ENVS.map((env) => {
        const isManaged = isManagedSupabaseEnv(env);
        const url = isManaged ? get(env.urlSecret) : undefined;
        const anon = isManaged ? get(env.anonSecret) : undefined;
        const svc = isManaged ? get(env.serviceSecret) : undefined;
        const last = isManaged ? (lastByEnv[env.key] ?? null) : null;
        const pendingStartedAt = pendingByEnv[env.key];
        const credsConfigured = !!url?.has_value && !!svc?.has_value;
        const suspicious = isManaged
          ? hasSuspiciousLength(secrets, [env.urlSecret, env.anonSecret, env.serviceSecret])
          : false;
        const credsLooksValid = credsConfigured && !suspicious;
        const preflightIssues = isManaged
          ? getPreflightIssues(secrets, [
              { name: env.urlSecret, label: 'URL do projeto' },
              { name: env.serviceSecret, label: 'Service Role Key' },
            ])
          : [];
        const status = resolveSupabaseConnectionStatus({
          readOnly: !isManaged,
          url,
          service: svc,
          last,
        });
        const canTest = isManaged && credsLooksValid && preflightIssues.length === 0;
        return (
          <Card
            key={env.key}
            data-retest-scope
            tabIndex={0}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{env.name}</CardTitle>
                </div>
                <ConnectionStatusBadge status={status} />
              </div>
              <CardDescription>{env.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isManaged ? (
                <p className="text-sm text-muted-foreground">
                  Credenciais gerenciadas automaticamente. Não requer configuração manual.
                </p>
              ) : (
                <>
                  <CardSourceDiagnostic
                    fields={[
                      { label: 'URL do projeto', status: url },
                      { label: 'Anon Key', status: anon },
                      { label: 'Service Role Key', status: svc },
                    ]}
                    loadError={listError}
                  />
                  <SecretField
                    label="URL do projeto"
                    secretName={env.urlSecret}
                    status={url}
                    onSaved={list}
                    connectionId={env.key}
                  />
                  <SecretField
                    label="Anon Key"
                    secretName={env.anonSecret}
                    status={anon}
                    onSaved={list}
                    connectionId={env.key}
                  />
                  <SecretField
                    label="Service Role Key"
                    secretName={env.serviceSecret}
                    status={svc}
                    onSaved={list}
                    connectionId={env.key}
                    helperText="Nunca exposto ao frontend. Usado apenas em edge functions admin."
                  />
                  <ConnectionPreflightAlert issues={preflightIssues} />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isTesting || !canTest}
                      title={
                        preflightIssues.length > 0
                          ? `Corrija ${preflightIssues.length === 1 ? 'o campo' : 'os campos'} acima antes de testar`
                          : !credsConfigured
                            ? 'Configure URL e Service Role Key primeiro'
                            : !credsLooksValid
                              ? 'Credenciais com formato suspeito (comprimento curto) — re-salve antes de testar'
                              : 'Testar conexão real'
                      }
                      onClick={() => handleTest(env.envKey, env.key)}
                    >
                      {isTesting ? 'Testando…' : 'Testar conexão'}
                    </Button>
                    <ConnectionTimelineDrawer
                      type="supabase"
                      label={env.name}
                      triggerVariant="ghost"
                      open={!!timelineOpenByEnv[env.key]}
                      onOpenChange={(v) =>
                        setTimelineOpenByEnv((cur) => ({ ...cur, [env.key]: v }))
                      }
                    />
                    <RefreshFromDbButton
                      onRefreshed={() => {
                        void list();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOverviewOpenByEnv((cur) => ({ ...cur, [env.key]: true }))}
                      title="Ver status, máscara e última rotação sem expor segredos"
                    >
                      <Eye className="mr-1 h-4 w-4" /> Ver detalhes
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/admin/external-db">
                        <ExternalLink className="mr-1 h-4 w-4" /> Ver schema
                      </Link>
                    </Button>
                    <RetestCooldownSelector className="ml-auto" />
                  </div>
                  <TestProgressIndicator
                    phase={phaseByEnv[env.key] ?? 'idle'}
                    latencyMs={last?.latency_ms ?? null}
                    message={last?.ok ? `HTTP ${last?.status ?? 200}` : (last?.message ?? null)}
                    onDismiss={() => setPhaseByEnv((cur) => ({ ...cur, [env.key]: 'idle' }))}
                  />
                  <LastTestLine
                    info={last}
                    autoFocusOnFailure
                    onClick={
                      last?.tested_at
                        ? () => setDetailsDialogByEnv((cur) => ({ ...cur, [env.key]: true }))
                        : undefined
                    }
                    action={
                      <RetestButton
                        onRetest={() => handleTest(env.envKey, env.key)}
                        disabled={!canTest}
                        cooldownKey={`supabase:${env.envKey}`}
                        disabledReason={
                          preflightIssues.length > 0
                            ? 'Corrija os campos sinalizados acima antes de testar'
                            : !credsConfigured
                              ? 'Configure URL e Service Role Key primeiro'
                              : 'Credenciais com formato suspeito — re-salve antes de testar'
                        }
                      />
                    }
                  />
                  <ConnectionTestHistoryPanel
                    type="supabase"
                    envKey={env.envKey}
                    label={env.name}
                    refreshKey={historyKeyByEnv[env.key] ?? 0}
                    pendingTest={pendingStartedAt ? { startedAt: pendingStartedAt } : null}
                  />
                  <ConnectionTestDetailsDialog
                    open={!!detailsDialogByEnv[env.key]}
                    onOpenChange={(v) => setDetailsDialogByEnv((cur) => ({ ...cur, [env.key]: v }))}
                    connectionType="supabase"
                    connectionLabel={env.name}
                    envKey={env.envKey}
                    onViewFullHistory={() =>
                      setTimelineOpenByEnv((cur) => ({ ...cur, [env.key]: true }))
                    }
                  />
                  <ConnectionDetailsDialog
                    open={!!overviewOpenByEnv[env.key]}
                    onOpenChange={(v) => setOverviewOpenByEnv((cur) => ({ ...cur, [env.key]: v }))}
                    connectionLabel={env.name}
                    description={env.description}
                    status={status}
                    last={last}
                    fields={[
                      { label: 'URL do projeto', secretName: env.urlSecret, status: url },
                      { label: 'Anon Key', secretName: env.anonSecret, status: anon },
                      {
                        label: 'Service Role Key',
                        secretName: env.serviceSecret,
                        status: svc,
                        sensitive: true,
                      },
                    ]}
                    onOpenFullHistory={() =>
                      setTimelineOpenByEnv((cur) => ({ ...cur, [env.key]: true }))
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
