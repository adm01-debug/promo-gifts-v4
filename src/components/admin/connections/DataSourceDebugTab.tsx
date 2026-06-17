import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Bug,
  Database,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useSecretsManager } from '@/hooks/admin';
import { ExpectedKeysMatchPanel } from './ExpectedKeysMatchPanel';
import { LastSyncRunPanel } from './LastSyncRunPanel';
import { CredentialCacheMetricsPanel } from './CredentialCacheMetricsPanel';
import { BridgeProductsPreviewPanel } from './BridgeProductsPreviewPanel';
import { FieldSourceDrillDownDialog, type FieldDrillDownData } from './FieldSourceDrillDownDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ExternalConnRow = {
  id: string;
  name: string | null;
  type: string | null;
  status: string | null;
  env_key: string | null;
  last_test_at: string | null;
  updated_at: string | null;
};

type DataSourceMap = {
  field: string;
  description: string;
  source: 'integration_credentials' | 'external_connections' | 'ambos (sync trigger)';
  notes: string;
};

const FIELD_MAP: DataSourceMap[] = [
  {
    field: 'URL / API Key (valor mascarado)',
    description: 'Valores mostrados nos cards Catálogo/CRM Promobrind',
    source: 'integration_credentials',
    notes: 'Lido via edge function `secrets-manager` (RLS por admin)',
  },
  {
    field: 'Status (Ativo/Inativo)',
    description: 'Badge verde/cinza nos cards e tabela Overview',
    source: 'ambos (sync trigger)',
    notes: 'SSOT em `integration_credentials`; espelhado por trigger',
  },
  {
    field: 'Histórico de testes (last_test_at, latência)',
    description: "Coluna 'Último teste' em ConnectionsOverviewTable",
    source: 'external_connections',
    notes: "Atualizado pelo botão 'Testar conexão' e auto-test cron",
  },
  {
    field: 'Health agregado (Pulse Bar, Saúde)',
    description: 'Indicador no topo + zona Saúde',
    source: 'external_connections',
    notes: 'Usa status + last_test_at desta tabela',
  },
  {
    field: 'Lista de produtos (catálogo)',
    description: 'Dados do banco Promobrind',
    source: 'integration_credentials',
    notes: 'URL/key consumidos pelo `external-db-bridge` em runtime',
  },
];

export function DataSourceDebugTab() {
  const { secrets, list, isLoading: secretsLoading } = useSecretsManager();
  const [extConns, setExtConns] = useState<ExternalConnRow[] | null>(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);
  const [credFilter, setCredFilter] = useState('');
  const [extFilter, setExtFilter] = useState('');

  const loadExternal = useCallback(async () => {
    setExtLoading(true);
    setExtError(null);
    const { data, error } = await supabase
      .from('external_connections')
      .select('id,name,type,status,env_key,last_test_at,updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      setExtError(error.message);
      setExtConns([]);
    } else {
      setExtConns((data ?? []) as ExternalConnRow[]);
    }
    setExtLoading(false);
  }, []);

  useEffect(() => {
    list();
    loadExternal();
  }, [list, loadExternal]);

  const refresh = useCallback(() => {
    list();
    loadExternal();
    toast.success('Dados de debug recarregados');
  }, [list, loadExternal]);

  const integrationCount = secrets.length;
  const externalCount = extConns?.length ?? 0;
  const inSync = !secretsLoading && !extLoading && integrationCount === externalCount;

  const credQuery = credFilter.trim().toLowerCase();
  const filteredSecrets = credQuery
    ? secrets.filter(
        (s) =>
          (s.name ?? '').toLowerCase().includes(credQuery) ||
          (s.source ?? '').toLowerCase().includes(credQuery),
      )
    : secrets;
  const extQuery = extFilter.trim().toLowerCase();
  const filteredExtConns = extQuery
    ? (extConns ?? []).filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(extQuery) ||
          (c.type ?? '').toLowerCase().includes(extQuery) ||
          (c.status ?? '').toLowerCase().includes(extQuery),
      )
    : (extConns ?? []);

  // Drill-down: dialog do campo selecionado
  const [drillField, setDrillField] = useState<string | null>(null);
  const fmtTs = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('pt-BR') : '—';

  const drillData: FieldDrillDownData | null = useMemo(() => {
    if (!drillField) return null;
    const row = FIELD_MAP.find((r) => r.field === drillField);
    if (!row) return null;

    const externalSecrets = secrets.filter((s) => s.name.startsWith('EXTERNAL_'));

    const base = {
      field: row.field,
      description: row.description,
      source: row.source,
      notes: row.notes,
    };

    switch (row.field) {
      case 'URL / API Key (valor mascarado)':
        return {
          ...base,
          technicalSource: {
            kind: 'edge_function' as const,
            name: 'secrets-manager (action: list)',
            snippet:
              "supabase.functions.invoke('secrets-manager', {\n  body: { action: 'list' }\n})\n// retorna: [{ name, has_value, masked_suffix, source, updated_at }]",
          },
          samples: externalSecrets.map((s) => ({
            label: s.name,
            display: s.has_value
              ? s.masked_suffix
                ? `••••${s.masked_suffix}`
                : '(valor presente, sem sufixo)'
              : '(vazio)',
            badge: {
              text: s.has_value ? (s.source ?? 'db') : 'vazio',
              tone: s.has_value ? 'ok' : 'warn',
            } as const,
          })),
          emptyMessage: 'Nenhum secret EXTERNAL_* retornado pela edge function.',
        };

      case 'Status (Ativo/Inativo)':
        return {
          ...base,
          technicalSource: {
            kind: 'trigger' as const,
            name: 'sync_external_connections_from_credentials()',
            snippet:
              "-- SSOT: integration_credentials.length > 0\n-- Espelho: external_connections.status\n--   = 'active' se URL e SERVICE_ROLE_KEY presentes,\n--   senão 'unconfigured'.\nINSERT INTO external_connections(...) ON CONFLICT (env_key, type) DO UPDATE\n  SET status = EXCLUDED.status, updated_at = now();",
          },
          samples: (extConns ?? []).map((c) => ({
            label: `${c.name ?? c.id} (env_key=${c.env_key ?? '—'})`,
            display: `status = ${c.status ?? '—'}`,
            badge: {
              text: c.status ?? '—',
              tone: c.status === 'active' ? 'ok' : c.status === 'unconfigured' ? 'warn' : 'neutral',
            } as const,
          })),
        };

      case 'Histórico de testes (last_test_at, latência)':
        return {
          ...base,
          technicalSource: {
            kind: 'table_query' as const,
            name: 'external_connections.last_test_at',
            snippet:
              "supabase\n  .from('external_connections')\n  .select('id,name,status,last_test_at,updated_at')\n  .order('updated_at', { ascending: false })",
          },
          samples: (extConns ?? []).map((c) => ({
            label: c.name ?? c.id,
            display: `last_test_at = ${fmtTs(c.last_test_at)}`,
            badge: {
              text: c.last_test_at ? 'registrado' : 'nunca testado',
              tone: c.last_test_at ? 'ok' : 'warn',
            } as const,
          })),
        };

      case 'Health agregado (Pulse Bar, Saúde)': {
        const total = extConns?.length ?? 0;
        const active = (extConns ?? []).filter((c) => c.status === 'active').length;
        return {
          ...base,
          technicalSource: {
            kind: 'hook' as const,
            name: 'derived from external_connections',
            snippet:
              "// Cálculo no client\nconst total  = rows.length;\nconst active = rows.filter(r => r.status === 'active').length;\nconst health = total === 0 ? 0 : active / total; // 0..1",
          },
          samples: [
            {
              label: 'Conexões totais',
              display: `${total} linha(s) em external_connections`,
              badge: { text: String(total), tone: 'neutral' },
            },
            {
              label: 'Conexões ativas',
              display: `${active} com status = 'active'`,
              badge: {
                text:
                  total > 0 && active === total
                    ? '100%'
                    : `${total === 0 ? 0 : Math.round((active / total) * 100)}%`,
                tone: total > 0 && active === total ? 'ok' : active === 0 ? 'error' : 'warn',
              },
            },
            ...(extConns ?? []).map((c) => ({
              label: c.name ?? c.id,
              display: `status=${c.status ?? '—'} • last_test=${fmtTs(c.last_test_at)}`,
              badge: {
                text: c.status ?? '—',
                tone: (c.status === 'active' ? 'ok' : 'warn') as 'ok' | 'warn',
              },
            })),
          ],
        };
      }

      case 'Lista de produtos (catálogo)': {
        const url = secrets.find((s) => s.name === 'EXTERNAL_PROMOBRIND_URL');
        const svc = secrets.find((s) => s.name === 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');
        return {
          ...base,
          technicalSource: {
            kind: 'edge_function' as const,
            name: 'external-db-bridge (op: select_products)',
            snippet:
              "// Edge function lê EXTERNAL_PROMOBRIND_URL + _SERVICE_ROLE_KEY\n// (de integration_credentials, via secrets-manager interno)\n// e cria um client Supabase apontando para o BD do catálogo.\nconst client = createClient(URL, SERVICE_ROLE_KEY);\nawait client.from('products').select(...);",
          },
          samples: [
            {
              label: 'EXTERNAL_PROMOBRIND_URL',
              display: url?.has_value
                ? url.masked_suffix
                  ? `••••${url.masked_suffix}`
                  : '(valor presente)'
                : '(vazio)',
              badge: {
                text: url?.has_value ? (url.source ?? 'db') : 'vazio',
                tone: url?.has_value ? 'ok' : 'error',
              } as const,
            },
            {
              label: 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
              display: svc?.has_value
                ? svc.masked_suffix
                  ? `••••${svc.masked_suffix}`
                  : '(valor presente)'
                : '(vazio)',
              badge: {
                text: svc?.has_value ? (svc.source ?? 'db') : 'vazio',
                tone: svc?.has_value ? 'ok' : 'error',
              } as const,
            },
          ],
        };
      }

      default:
        return {
          ...base,
          technicalSource: { kind: 'table_query' as const, name: '—', snippet: '—' },
          samples: [],
        };
    }
  }, [drillField, secrets, extConns]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Bug className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Debug de Origem de Dados</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Compara as duas fontes que alimentam esta tela:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">integration_credentials</code>{' '}
              (SSOT, valores secretos) e{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">external_connections</code>{' '}
              (espelho operacional, histórico de testes).
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={secretsLoading || extLoading}
        >
          <RefreshCw
            className={cn('mr-2 h-4 w-4', secretsLoading || (extLoading && 'animate-spin'))}
          />
          Recarregar
        </Button>
      </div>

      {/* Counts */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              integration_credentials
            </CardTitle>
            <CardDescription className="text-xs">
              SSOT — valores secretos (mascarados)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {secretsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold tabular-nums">{integrationCount}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              linha(s) acessíveis via edge function
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-primary" />
              external_connections
            </CardTitle>
            <CardDescription className="text-xs">Espelho operacional + histórico</CardDescription>
          </CardHeader>
          <CardContent>
            {extLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold tabular-nums">{externalCount}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">linha(s) na tabela espelhada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {inSync ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              Sincronização
            </CardTitle>
            <CardDescription className="text-xs">
              Trigger:{' '}
              <code className="text-[10px]">sync_external_connections_from_credentials</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {secretsLoading || extLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <Badge
                variant={inSync ? 'default' : 'secondary'}
                className={inSync ? 'bg-green-600' : ''}
              >
                {inSync ? 'Espelhado' : 'Divergente'}
              </Badge>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {inSync
                ? 'Ambas tabelas têm o mesmo nº de linhas.'
                : `Diferença de ${Math.abs(integrationCount - externalCount)} linha(s).`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Field map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa de campos → fonte</CardTitle>
          <CardDescription>De onde cada dado mostrado em /admin/conexoes é lido</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Campo / UI</th>
                  <th className="py-2 pr-3 font-medium">Origem</th>
                  <th className="py-2 pr-3 font-medium">Observações</th>
                  <th className="py-2 text-right font-medium">Drill-down</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_MAP.map((row) => (
                  <tr
                    key={row.field}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDrillField(row.field)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDrillField(row.field);
                      }
                    }}
                    className="cursor-pointer border-b align-top outline-none last:border-0 hover:bg-muted/40 focus:bg-muted/60"
                    aria-label={`Ver origem técnica e amostras de ${row.field}`}
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.field}</div>
                      <div className="text-xs text-muted-foreground">{row.description}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className={
                          row.source === 'integration_credentials'
                            ? 'border-primary/40 text-primary'
                            : row.source === 'external_connections'
                              ? 'border-blue-500/40 text-blue-600'
                              : 'border-green-500/40 text-green-700'
                        }
                      >
                        {row.source}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{row.notes}</td>
                    <td className="py-2 text-right">
                      <ChevronRight
                        className="inline h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comparação de chaves esperadas × fontes */}
      <ExpectedKeysMatchPanel
        secrets={secrets}
        extConns={(extConns ?? []).map((c) => ({ env_key: c.env_key, type: c.type, name: c.name }))}
        loading={secretsLoading || extLoading}
      />

      {/* Última execução do trigger de sync */}
      <LastSyncRunPanel />

      {/* Métricas de cache da SSOT (resolveCredential) */}
      <CredentialCacheMetricsPanel />

      {/* Pré-visualização paginada dos produtos retornados pelo external-db-bridge */}
      <BridgeProductsPreviewPanel />

      {/* Raw rows */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">integration_credentials (linhas)</CardTitle>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {credQuery ? `${filteredSecrets.length}/${secrets.length}` : `${secrets.length}`}{' '}
                linha(s)
              </span>
            </div>
            <div className="relative mt-2">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={credFilter}
                onChange={(e) => setCredFilter(e.target.value)}
                placeholder="Filtrar por nome (ex.: PROMOBRIND, CRM)…"
                className="h-8 pl-7 pr-7 text-xs"
                aria-label="Filtrar credenciais por nome"
              />
              {credFilter && (
                <button
                  type="button"
                  onClick={() => setCredFilter('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                  aria-label="Limpar filtro de credenciais"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {secretsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : secrets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma credencial encontrada.</p>
            ) : filteredSecrets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum resultado para “{credFilter}”.</p>
            ) : (
              <ul className="space-y-1.5 font-mono text-xs">
                {filteredSecrets.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-2 border-b pb-1.5 last:border-0"
                  >
                    <span className="truncate">{s.name}</span>
                    <div className="flex items-center gap-1.5">
                      {s.masked_suffix && (
                        <span className="text-[10px] text-muted-foreground">
                          ••••{s.masked_suffix}
                        </span>
                      )}
                      <Badge
                        variant={s.has_value ? 'default' : 'secondary'}
                        className={cn('text-[10px]', s.has_value && 'bg-green-600')}
                      >
                        {s.has_value ? (s.source ?? 'db') : 'vazio'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">external_connections (linhas)</CardTitle>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {extQuery
                  ? `${filteredExtConns.length}/${extConns?.length ?? 0}`
                  : `${extConns?.length ?? 0}`}{' '}
                linha(s)
              </span>
            </div>
            <div className="relative mt-2">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={extFilter}
                onChange={(e) => setExtFilter(e.target.value)}
                placeholder="Filtrar por nome, tipo ou status…"
                className="h-8 pl-7 pr-7 text-xs"
                aria-label="Filtrar conexões externas"
              />
              {extFilter && (
                <button
                  type="button"
                  onClick={() => setExtFilter('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                  aria-label="Limpar filtro de conexões"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {extLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : extError ? (
              <p className="text-xs text-destructive">Erro: {extError}</p>
            ) : !extConns || extConns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma linha encontrada.</p>
            ) : filteredExtConns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum resultado para “{extFilter}”.</p>
            ) : (
              <ul className="space-y-1.5 font-mono text-xs">
                {filteredExtConns.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 border-b pb-1.5 last:border-0"
                  >
                    <span className="truncate">{c.name ?? c.id}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {c.type ?? '—'}
                      </Badge>
                      <Badge
                        variant={c.status === 'active' ? 'default' : 'secondary'}
                        className={cn('text-[10px]', c.status === 'active' && 'bg-green-600')}
                      >
                        {c.status ?? '—'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <FieldSourceDrillDownDialog
        open={drillField !== null}
        onOpenChange={(o) => {
          if (!o) setDrillField(null);
        }}
        data={drillData}
      />
    </div>
  );
}
