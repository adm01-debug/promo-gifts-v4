import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Briefcase,
  Workflow,
  Plug,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useSecretsManager, type SecretStatus } from '@/hooks/admin';
import { cn } from '@/lib/utils';

type Severity = 'required' | 'recommended' | 'optional';

type ExpectedKey = {
  name: string;
  severity: Severity;
  /** O que quebra se faltar. */
  impact: string;
};

type FeatureGroup = {
  id: string;
  label: string;
  description: string;
  Icon: typeof Database;
  /** Áreas da UI que dependem deste grupo. */
  uiSurfaces: string[];
  keys: ExpectedKey[];
};

/**
 * Contrato canônico de chaves esperadas por feature.
 * Espelha `ALLOWED_SECRETS` em supabase/functions/secrets-manager/index.ts.
 */
const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'catalog',
    label: 'Catálogo Promobrind',
    description: 'Banco externo que alimenta toda a listagem de produtos, variantes e imagens.',
    Icon: Database,
    uiSurfaces: ['/catalogo', '/produto/:slug', 'Kit Maker', 'Comparador', 'Busca semântica'],
    keys: [
      {
        name: 'EXTERNAL_PROMOBRIND_URL',
        severity: 'required',
        impact: 'Sem URL, a edge function external-db-bridge não conecta — catálogo fica vazio.',
      },
      {
        name: 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
        severity: 'required',
        impact: 'Sem service role, queries falham com 401 — produtos/variantes não carregam.',
      },
      {
        name: 'EXTERNAL_PROMOBRIND_ANON_KEY',
        severity: 'recommended',
        impact: 'Necessária apenas se usarmos o client público no futuro — hoje é fallback.',
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM Promobrind',
    description: 'Banco externo para empresas, contatos e sincronização de orçamentos.',
    Icon: Database,
    uiSurfaces: ['Seletor de empresa', 'Orçamentos', '/orcamentos/novo', '/admin/empresas'],
    keys: [
      {
        name: 'EXTERNAL_CRM_URL',
        severity: 'required',
        impact: 'Sem URL, o seletor de empresas e a sync de orçamentos param.',
      },
      {
        name: 'EXTERNAL_CRM_SERVICE_ROLE_KEY',
        severity: 'required',
        impact: 'Sem service role, leituras protegidas (companies, contatos) retornam 401.',
      },
      {
        name: 'EXTERNAL_CRM_ANON_KEY',
        severity: 'recommended',
        impact: 'Reservada para fluxos públicos. Hoje opcional.',
      },
    ],
  },
  {
    id: 'bitrix24',
    label: 'Bitrix24',
    description: 'Integração CRM Bitrix24 (sync de orçamentos, deals e contatos).',
    Icon: Briefcase,
    uiSurfaces: ['Sync de orçamentos → Bitrix24', '/admin/conexoes › Bitrix24'],
    keys: [
      {
        name: 'BITRIX24_WEBHOOK_URL',
        severity: 'required',
        impact: 'Sem webhook, nenhum payload é entregue ao Bitrix24.',
      },
      {
        name: 'BITRIX24_DOMAIN',
        severity: 'required',
        impact: 'Necessário para construir URLs e validar tenant.',
      },
      {
        name: 'BITRIX24_USER_ID',
        severity: 'required',
        impact: 'Identifica o usuário-bot que cria os registros.',
      },
      {
        name: 'BITRIX24_TOKEN',
        severity: 'required',
        impact: 'Token de autenticação do webhook Bitrix24.',
      },
    ],
  },
  {
    id: 'n8n',
    label: 'n8n (Automação)',
    description: 'Disparos automatizados, webhooks de workflows e jobs agendados via n8n.',
    Icon: Workflow,
    uiSurfaces: ['/admin/conexoes › n8n', 'Workflows automáticos pós-orçamento'],
    keys: [
      {
        name: 'N8N_BASE_URL',
        severity: 'required',
        impact: 'Sem URL base, nenhum workflow n8n é disparado.',
      },
      {
        name: 'N8N_API_KEY',
        severity: 'required',
        impact: 'Sem API key, todas as chamadas ao n8n retornam 401.',
      },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP (Claude/IA)',
    description: 'Canal seguro para o assistente do Lovable consumir recursos do projeto.',
    Icon: Plug,
    uiSurfaces: ['/admin/conexoes › MCP', 'Integração com Claude Desktop'],
    keys: [
      {
        name: 'MCP_SHARED_SECRET',
        severity: 'recommended',
        impact: 'Necessário apenas se MCP estiver ativado. Sem ele, o canal é rejeitado.',
      },
    ],
  },
];

type EvalRow = {
  group: FeatureGroup;
  expected: ExpectedKey;
  status: 'ok' | 'empty' | 'missing';
  source: SecretStatus['source'] | null;
  maskedSuffix: string | null;
};

function classifyKey(expected: ExpectedKey, secrets: SecretStatus[]): EvalRow['status'] {
  const s = secrets.find((x) => x.name === expected.name);
  if (!s) return 'missing';
  if (!s.has_value) return 'empty';
  return 'ok';
}

const SEV_BADGE: Record<Severity, { label: string; cls: string }> = {
  required: {
    label: 'obrigatório',
    cls: 'border-destructive/40 text-destructive bg-destructive/5',
  },
  recommended: { label: 'recomendado', cls: 'border-amber-500/40 text-amber-700 bg-amber-500/5' },
  optional: { label: 'opcional', cls: 'border-muted-foreground/30 text-muted-foreground' },
};

const STATUS_META: Record<
  EvalRow['status'],
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: 'configurado',
    cls: 'border-green-500/40 text-green-700 bg-green-500/5',
    Icon: CheckCircle2,
  },
  empty: {
    label: 'vazio',
    cls: 'border-amber-500/40 text-amber-700 bg-amber-500/5',
    Icon: AlertTriangle,
  },
  missing: {
    label: 'faltando',
    cls: 'border-destructive/40 text-destructive bg-destructive/5',
    Icon: XCircle,
  },
};

export function KeysValidationTab() {
  const { secrets, list, isLoading: loading } = useSecretsManager();
  const [filter, setFilter] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    list();
  }, [list]);

  const evaluations: EvalRow[] = useMemo(() => {
    const out: EvalRow[] = [];
    for (const group of FEATURE_GROUPS) {
      for (const k of group.keys) {
        const s = secrets.find((x) => x.name === k.name);
        out.push({
          group,
          expected: k,
          status: classifyKey(k, secrets),
          source: s?.has_value ? (s.source ?? null) : null,
          maskedSuffix: s?.masked_suffix ?? null,
        });
      }
    }
    return out;
  }, [secrets]);

  // KPIs globais
  const totals = useMemo(() => {
    const total = evaluations.length;
    const ok = evaluations.filter((e) => e.status === 'ok').length;
    const issues = evaluations.filter((e) => e.status !== 'ok');
    const blockers = issues.filter((e) => e.expected.severity === 'required').length;
    const warnings = issues.filter((e) => e.expected.severity === 'recommended').length;
    return { total, ok, blockers, warnings, issuesCount: issues.length };
  }, [evaluations]);

  const score = totals.total === 0 ? 0 : Math.round((totals.ok / totals.total) * 100);
  const query = filter.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return FEATURE_GROUPS.map((g) => {
      const rows = evaluations.filter((e) => e.group.id === g.id);
      const filteredRows = rows.filter((r) => {
        if (onlyIssues && r.status === 'ok') return false;
        if (!query) return true;
        return (
          r.expected.name.toLowerCase().includes(query) ||
          g.label.toLowerCase().includes(query) ||
          g.uiSurfaces.some((u) => u.toLowerCase().includes(query))
        );
      });
      const groupOk = rows.every((r) => r.status === 'ok');
      const groupBlockers = rows.filter(
        (r) => r.status !== 'ok' && r.expected.severity === 'required',
      ).length;
      const groupWarnings = rows.filter(
        (r) => r.status !== 'ok' && r.expected.severity === 'recommended',
      ).length;
      return { group: g, rows: filteredRows, allRows: rows, groupOk, groupBlockers, groupWarnings };
    }).filter((g) => g.rows.length > 0);
  }, [evaluations, query, onlyIssues]);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Validação de chaves para UI e catálogos</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Confronta o contrato canônico (definido em{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">secrets-manager</code>) com o
              estado atual de{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">integration_credentials</code>{' '}
              e ENV. Bloqueadores destacam chaves obrigatórias faltando.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => list()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Recarregar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score de configuração</CardTitle>
            <CardDescription className="text-xs">
              {totals.ok} de {totals.total} chaves ok
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    score === 100
                      ? 'text-green-600'
                      : score >= 80
                        ? 'text-amber-600'
                        : 'text-destructive',
                  )}
                >
                  {score}%
                </div>
                <Progress value={score} className="h-1.5" />
              </>
            )}
          </CardContent>
        </Card>
        <Card className={totals.blockers > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <XCircle
                className={cn(
                  'h-4 w-4',
                  totals.blockers > 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              />
              Bloqueadores
            </CardTitle>
            <CardDescription className="text-xs">Chaves obrigatórias faltando</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold tabular-nums',
                totals.blockers > 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {totals.blockers}
            </div>
          </CardContent>
        </Card>
        <Card className={totals.warnings > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  totals.warnings > 0 ? 'text-amber-600' : 'text-muted-foreground',
                )}
              />
              Avisos
            </CardTitle>
            <CardDescription className="text-xs">Recomendadas faltando</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold tabular-nums',
                totals.warnings > 0 ? 'text-amber-600' : 'text-muted-foreground',
              )}
            >
              {totals.warnings}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Configuradas
            </CardTitle>
            <CardDescription className="text-xs">Com valor presente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-green-600">{totals.ok}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por chave, feature ou superfície da UI…"
            className="h-9 pl-7 pr-7 text-sm"
            aria-label="Buscar chave"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          variant={onlyIssues ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyIssues((v) => !v)}
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Só problemas {totals.issuesCount > 0 && `(${totals.issuesCount})`}
        </Button>
      </div>

      {/* Grupos */}
      {loading && evaluations.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum resultado para os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map(({ group, rows, allRows, groupOk, groupBlockers, groupWarnings }) => {
            const Icon = group.Icon;
            const isCollapsed = collapsed.has(group.id);
            return (
              <Card
                key={group.id}
                className={cn(
                  groupBlockers > 0 && 'border-destructive/40',
                  groupBlockers === 0 && groupWarnings > 0 && 'border-amber-500/40',
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(group.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      aria-expanded={!isCollapsed}
                    >
                      <div className="mt-0.5">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          groupOk
                            ? 'bg-green-500/10'
                            : groupBlockers > 0
                              ? 'bg-destructive/10'
                              : 'bg-amber-500/10',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            groupOk
                              ? 'text-green-600'
                              : groupBlockers > 0
                                ? 'text-destructive'
                                : 'text-amber-600',
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{group.label}</CardTitle>
                        <CardDescription className="text-xs">{group.description}</CardDescription>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {group.uiSurfaces.map((u) => (
                            <Badge key={u} variant="outline" className="font-mono text-[10px]">
                              {u}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {groupOk ? (
                        <Badge
                          variant="outline"
                          className="border-green-500/40 bg-green-500/5 text-green-700"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> ok
                        </Badge>
                      ) : (
                        <>
                          {groupBlockers > 0 && (
                            <Badge
                              variant="outline"
                              className="border-destructive/40 bg-destructive/5 text-destructive"
                            >
                              <XCircle className="mr-1 h-3 w-3" /> {groupBlockers} bloqueador(es)
                            </Badge>
                          )}
                          {groupWarnings > 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/5 text-amber-700"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" /> {groupWarnings} aviso(s)
                            </Badge>
                          )}
                        </>
                      )}
                      <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                        {allRows.filter((r) => r.status === 'ok').length}/{allRows.length}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="pt-0">
                    <ul className="divide-y border-t">
                      {rows.map((r) => {
                        const sm = STATUS_META[r.status];
                        const SIcon = sm.Icon;
                        const sev = SEV_BADGE[r.expected.severity];
                        return (
                          <li
                            key={r.expected.name}
                            className="flex flex-wrap items-start justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                  {r.expected.name}
                                </code>
                                <Badge variant="outline" className={cn('text-[10px]', sev.cls)}>
                                  {sev.label}
                                </Badge>
                                {r.status === 'ok' && r.source && (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] uppercase"
                                  >
                                    {r.source}
                                    {r.maskedSuffix ? ` • ••••${r.maskedSuffix}` : ''}
                                  </Badge>
                                )}
                              </div>
                              <p
                                className={cn(
                                  'mt-1 text-[11px]',
                                  r.status === 'ok' ? 'text-muted-foreground' : 'text-foreground',
                                )}
                              >
                                {r.status === 'ok'
                                  ? 'Sem impacto — chave presente.'
                                  : r.expected.impact}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn('shrink-0', sm.cls)}>
                              <SIcon className="mr-1 h-3 w-3" />
                              {sm.label}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
