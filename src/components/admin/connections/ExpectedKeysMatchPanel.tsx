import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, GitCompare, KeyRound, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Painel de comparação: chaves esperadas (canônicas) × integration_credentials × external_connections.
 *
 * Regras (espelham `sync_external_connections_from_credentials`):
 *  - Para cada env_key em ENV_KEYS, esperamos 3 secrets:
 *      EXTERNAL_<KEY>_URL, EXTERNAL_<KEY>_ANON_KEY, EXTERNAL_<KEY>_SERVICE_ROLE_KEY
 *  - E uma linha em external_connections com env_key = <KEY> e type = 'supabase'.
 */

const ENV_KEYS = [
  { key: 'promobrind', label: 'Catálogo Promobrind' },
  { key: 'crm', label: 'CRM Promobrind' },
] as const;

const SECRET_SUFFIXES = ['URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'] as const;

const EXPECTED_SECRET_NAMES: ReadonlySet<string> = new Set(
  ENV_KEYS.flatMap(({ key }) =>
    SECRET_SUFFIXES.map((suf) => `EXTERNAL_${key.toUpperCase()}_${suf}`),
  ),
);

const EXPECTED_ENV_KEYS: ReadonlySet<string> = new Set(ENV_KEYS.map((e) => e.key.toLowerCase()));

type SecretRow = { name: string; has_value?: boolean };
type ExtRow = { env_key: string | null; type: string | null; name: string | null };

export type ExpectedKeysMatchPanelProps = {
  secrets: SecretRow[];
  extConns: ExtRow[];
  loading?: boolean;
};

type EnvDiagnosis = {
  envKey: string;
  label: string;
  expectedSecrets: Array<{ name: string; present: boolean; hasValue: boolean }>;
  hasExtConn: boolean;
  extName: string | null;
  ok: boolean;
  issues: string[];
};

export function ExpectedKeysMatchPanel({
  secrets,
  extConns,
  loading,
}: ExpectedKeysMatchPanelProps) {
  const secretMap = useMemo(() => {
    const m = new Map<string, SecretRow>();
    for (const s of secrets) m.set(s.name.toUpperCase(), s);
    return m;
  }, [secrets]);

  const extByEnvKey = useMemo(() => {
    const m = new Map<string, ExtRow>();
    for (const c of extConns) {
      if (c.env_key) m.set(c.env_key.toLowerCase(), c);
    }
    return m;
  }, [extConns]);

  const diagnoses: EnvDiagnosis[] = useMemo(() => {
    return ENV_KEYS.map(({ key, label }) => {
      const expected = SECRET_SUFFIXES.map((suf) => {
        const name = `EXTERNAL_${key.toUpperCase()}_${suf}`;
        const row = secretMap.get(name);
        return {
          name,
          present: !!row,
          hasValue: !!row?.has_value,
        };
      });
      const ext = extByEnvKey.get(key);
      const issues: string[] = [];
      for (const e of expected) {
        if (!e.present) issues.push(`Faltando: ${e.name}`);
        else if (!e.hasValue) issues.push(`Vazio: ${e.name}`);
      }
      if (!ext) issues.push(`Sem linha em external_connections (env_key=${key})`);

      return {
        envKey: key,
        label,
        expectedSecrets: expected,
        hasExtConn: !!ext,
        extName: ext?.name ?? null,
        ok: issues.length === 0,
        issues,
      };
    });
  }, [secretMap, extByEnvKey]);

  // Órfãos: presentes em uma fonte mas não esperados / sem par na outra
  const expectedSecretNames = EXPECTED_SECRET_NAMES;
  const expectedEnvKeys = EXPECTED_ENV_KEYS;

  const orphanSecrets = useMemo(
    () =>
      secrets
        .filter(
          (s) => s.name.startsWith('EXTERNAL_') && !expectedSecretNames.has(s.name.toUpperCase()),
        )
        .map((s) => s.name),
    [secrets, expectedSecretNames],
  );

  const orphanExtConns = useMemo(
    () =>
      extConns
        .filter((c) => !!c.env_key && !expectedEnvKeys.has(c.env_key.toLowerCase()))
        .map((c) => ({ env_key: c.env_key as string, name: c.name })),
    [extConns, expectedEnvKeys],
  );

  const totalIssues =
    diagnoses.reduce((acc, d) => acc + d.issues.length, 0) +
    orphanSecrets.length +
    orphanExtConns.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Comparação de chaves esperadas</CardTitle>
              <CardDescription>
                Confronta o contrato canônico (
                <code className="rounded bg-muted px-1 text-[10px]">
                  EXTERNAL_&lt;KEY&gt;_URL/ANON_KEY/SERVICE_ROLE_KEY
                </code>
                ) com{' '}
                <code className="rounded bg-muted px-1 text-[10px]">integration_credentials</code> e{' '}
                <code className="rounded bg-muted px-1 text-[10px]">external_connections</code>.
              </CardDescription>
            </div>
          </div>
          {!loading && (
            <Badge
              variant={totalIssues === 0 ? 'default' : 'secondary'}
              className={
                totalIssues === 0
                  ? 'bg-green-600'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-700'
              }
            >
              {totalIssues === 0 ? 'Sem divergências' : `${totalIssues} divergência(s)`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Por env_key esperada */}
        <div className="grid gap-3 md:grid-cols-2">
          {diagnoses.map((d) => (
            <div
              key={d.envKey}
              className={cn(
                'space-y-2 rounded-lg border p-3',
                d.ok ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {d.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{d.label}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      env_key={d.envKey}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    d.hasExtConn
                      ? 'border-blue-500/40 text-[10px] text-blue-600'
                      : 'border-destructive/40 text-[10px] text-destructive'
                  }
                >
                  <Database className="mr-1 h-3 w-3" />
                  {d.hasExtConn ? 'ext: ok' : 'ext: ausente'}
                </Badge>
              </div>

              <ul className="space-y-1">
                {d.expectedSecrets.map((s) => {
                  const state: 'ok' | 'empty' | 'missing' = !s.present
                    ? 'missing'
                    : !s.hasValue
                      ? 'empty'
                      : 'ok';
                  return (
                    <li
                      key={s.name}
                      className="flex items-center justify-between gap-2 font-mono text-[11px]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          state === 'ok'
                            ? 'border-green-500/40 text-[10px] text-green-700'
                            : state === 'empty'
                              ? 'border-amber-500/40 text-[10px] text-amber-700'
                              : 'border-destructive/40 text-[10px] text-destructive'
                        }
                      >
                        {state === 'ok' ? 'ok' : state === 'empty' ? 'vazio' : 'faltando'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>

              {d.issues.length > 0 && (
                <div className="border-t border-amber-500/20 pt-1 text-[11px] text-amber-700 dark:text-amber-400">
                  {d.issues.map((i) => (
                    <div key={i}>• {i}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Órfãos */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Credenciais sem correspondência
              </div>
              <Badge variant="outline" className="text-[10px]">
                {orphanSecrets.length}
              </Badge>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Secrets <code className="text-[10px]">EXTERNAL_*</code> em{' '}
              <code className="text-[10px]">integration_credentials</code> que não pertencem a um{' '}
              <code className="text-[10px]">env_key</code> esperado.
            </p>
            {orphanSecrets.length === 0 ? (
              <p className="text-[11px] italic text-muted-foreground">
                Nenhuma — todas as credenciais batem com o contrato.
              </p>
            ) : (
              <ul className="space-y-1 font-mono text-[11px]">
                {orphanSecrets.map((n) => (
                  <li
                    key={n}
                    className="flex items-center justify-between gap-2 border-b pb-1 last:border-0"
                  >
                    <span className="truncate">{n}</span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-[10px] text-amber-700"
                    >
                      órfão
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Database className="h-3.5 w-3.5 text-primary" />
                external_connections sem correspondência
              </div>
              <Badge variant="outline" className="text-[10px]">
                {orphanExtConns.length}
              </Badge>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Linhas em <code className="text-[10px]">external_connections</code> cujo{' '}
              <code className="text-[10px]">env_key</code> não está no contrato.
            </p>
            {orphanExtConns.length === 0 ? (
              <p className="text-[11px] italic text-muted-foreground">
                Nenhuma — todas as conexões espelham um env_key esperado.
              </p>
            ) : (
              <ul className="space-y-1 font-mono text-[11px]">
                {orphanExtConns.map((c) => (
                  <li
                    key={c.env_key}
                    className="flex items-center justify-between gap-2 border-b pb-1 last:border-0"
                  >
                    <span className="truncate">
                      {c.name ?? '—'} <span className="text-muted-foreground">({c.env_key})</span>
                    </span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-[10px] text-amber-700"
                    >
                      órfão
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
