/**
 * TestAllConnectionsButton
 *
 * Botão único no header de /admin/conexoes que valida automaticamente as
 * credenciais atuais de TODOS os ambientes Supabase externos (Promobrind +
 * CRM) num clique:
 *
 *   1. Lê o snapshot de credenciais via `secrets-manager` (action: list) —
 *      determina se cada secret está em DB (integration_credentials), em ENV
 *      (fallback legado) ou ausente. Mostra essa origem na UI.
 *   2. Para cada ambiente com credenciais mínimas (URL + Service Role Key)
 *      executa o `connection-tester` em paralelo (silent — sem toasts).
 *      O backend lê integration_credentials e tenta um SELECT real.
 *   3. Abre um dialog com resultado detalhado por ambiente: badge de origem,
 *      status (OK/erro), código HTTP, latência, mensagem amigável e horário.
 *
 * Não expõe nenhum valor de segredo — apenas máscaras e metadados.
 */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Database,
  Clock,
} from 'lucide-react';
import { useSecretsManager, type SecretStatus } from '@/hooks/admin';
import { useConnectionTester, type TestResult } from '@/hooks/intelligence';
import { resolveSource } from './CredentialsSourceFilterContext';
import { getErrorCopy } from '@/lib/connection-error-copy';
import { toast } from 'sonner';

type EnvKey = 'crm' | 'promobrind';

const TARGETS: Array<{
  envKey: EnvKey;
  label: string;
  urlSecret: string;
  anonSecret: string;
  serviceSecret: string;
}> = [
  {
    envKey: 'promobrind',
    label: 'Catálogo Promobrind',
    urlSecret: 'EXTERNAL_PROMOBRIND_URL',
    anonSecret: 'EXTERNAL_PROMOBRIND_ANON_KEY',
    serviceSecret: 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
  },
  {
    envKey: 'crm',
    label: 'CRM Promobrind',
    urlSecret: 'EXTERNAL_CRM_URL',
    anonSecret: 'EXTERNAL_CRM_ANON_KEY',
    serviceSecret: 'EXTERNAL_CRM_SERVICE_ROLE_KEY',
  },
];

interface PerEnvResult {
  envKey: EnvKey;
  label: string;
  /** Origem resolvida da URL + Service (DB / ENV / mixed / none). */
  credSummary: {
    url: 'db' | 'env' | 'none';
    service: 'db' | 'env' | 'none';
    anon: 'db' | 'env' | 'none';
  };
  /** True se URL + Service estão presentes (mínimo para testar). */
  testable: boolean;
  /** Resultado do connection-tester quando testável. */
  test?: TestResult;
  /** Motivo de não ser testável. */
  skipReason?: string;
}

function fmtTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour12: false });
}

const SOURCE_BADGE = {
  db: { label: 'DB', cls: 'border-success/40 bg-success/10 text-success' },
  env: { label: 'ENV', cls: 'border-warning/40 bg-warning/10 text-warning' },
  none: { label: 'AUSENTE', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
} as const;

export function TestAllConnectionsButton({ className }: { className?: string }) {
  const { list } = useSecretsManager();
  const { test } = useConnectionTester();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PerEnvResult[] | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [totalDurationMs, setTotalDurationMs] = useState<number | null>(null);

  const runAll = useCallback(async () => {
    setRunning(true);
    setOpen(true);
    setResults(null);
    setTotalDurationMs(null);
    const t0 = performance.now();
    setStartedAt(new Date().toISOString());

    // 1) Snapshot fresco de credenciais (origem DB/ENV/AUSENTE)
    const snapshot = (await list()) ?? [];
    const byName = new Map<string, SecretStatus>(snapshot.map((s) => [s.name, s]));

    // 2) Para cada alvo: resolve origens e dispara o teste em paralelo se testável
    const tasks = TARGETS.map(async (target): Promise<PerEnvResult> => {
      const url = byName.get(target.urlSecret);
      const anon = byName.get(target.anonSecret);
      const svc = byName.get(target.serviceSecret);
      const credSummary = {
        url: resolveSource(url),
        anon: resolveSource(anon),
        service: resolveSource(svc),
      };
      const testable = !!url?.has_value && !!svc?.has_value;
      if (!testable) {
        return {
          envKey: target.envKey,
          label: target.label,
          credSummary,
          testable: false,
          skipReason:
            !url?.has_value && !svc?.has_value
              ? 'URL e Service Role Key ausentes'
              : !url?.has_value
                ? 'URL do projeto ausente'
                : 'Service Role Key ausente',
        };
      }
      const r = await test('supabase', { env_key: target.envKey, silent: true });
      return {
        envKey: target.envKey,
        label: target.label,
        credSummary,
        testable: true,
        test: r,
      };
    });

    const all = await Promise.all(tasks);
    setResults(all);
    setTotalDurationMs(Math.round(performance.now() - t0));
    setRunning(false);

    const tested = all.filter((r) => r.testable);
    const okCount = tested.filter((r) => r.test?.ok).length;
    const failed = tested.length - okCount;
    if (tested.length === 0) {
      toast.warning('Nenhuma conexão testável', {
        description: 'Configure URL + Service Role Key antes de testar.',
      });
    } else if (failed === 0) {
      toast.success(`Todas as ${okCount} conexões OK`);
    } else {
      toast.error(`${failed} de ${tested.length} conexões com falha`);
    }
  }, [list, test]);

  const summary = useMemo(() => {
    if (!results) return null;
    const tested = results.filter((r) => r.testable);
    return {
      total: results.length,
      tested: tested.length,
      ok: tested.filter((r) => r.test?.ok).length,
      fail: tested.filter((r) => r.test && !r.test.ok).length,
      skipped: results.length - tested.length,
    };
  }, [results]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={runAll}
        disabled={running}
        className={className}
        title="Valida URL + Service Role Key de todos os ambientes externos via integration_credentials"
      >
        {running ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Testando…
          </>
        ) : (
          <>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Testar conexões
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Resultado do teste de conexões
            </DialogTitle>
            <DialogDescription>
              Credenciais lidas de{' '}
              <code className="font-mono text-[11px]">integration_credentials</code> via{' '}
              <code className="font-mono text-[11px]">secrets-manager</code>. Nenhum valor de
              segredo foi exposto — apenas máscaras e metadados.
            </DialogDescription>
          </DialogHeader>

          {/* Header de resumo */}
          {running && !results && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo credenciais e executando testes em
              paralelo…
            </div>
          )}

          {summary && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              {summary.ok > 0 && (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 font-mono text-[10px] uppercase text-success"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> OK · {summary.ok}
                </Badge>
              )}
              {summary.fail > 0 && (
                <Badge
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 font-mono text-[10px] uppercase text-destructive"
                >
                  <XCircle className="mr-1 h-3 w-3" /> Falha · {summary.fail}
                </Badge>
              )}
              {summary.skipped > 0 && (
                <Badge
                  variant="outline"
                  className="border-muted-foreground/40 bg-muted/40 font-mono text-[10px] uppercase text-muted-foreground"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" /> Sem credenciais · {summary.skipped}
                </Badge>
              )}
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {totalDurationMs ?? '?'}ms · iniciado às {fmtTime(startedAt ?? undefined)}
              </span>
            </div>
          )}

          {/* Linhas detalhadas */}
          {results && (
            <ul className="mt-2 space-y-3">
              {results.map((r) => (
                <ResultRow key={r.envKey} result={r} />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultRow({ result }: { result: PerEnvResult }) {
  const headerTone = !result.testable
    ? 'border-muted-foreground/30 bg-muted/30'
    : result.test?.ok
      ? 'border-success/40 bg-success/5'
      : 'border-destructive/40 bg-destructive/5';

  return (
    <li className={`rounded-lg border p-3 ${headerTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{result.label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{result.envKey}</span>
        </div>
        <StatusBadge result={result} />
      </div>

      {/* Origem das credenciais */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
        <CredCell label="URL" source={result.credSummary.url} />
        <CredCell label="Anon" source={result.credSummary.anon} />
        <CredCell label="Service" source={result.credSummary.service} />
      </div>

      {/* Detalhes do teste ou motivo de skip */}
      {!result.testable ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Não testado — {result.skipReason}.
        </p>
      ) : result.test ? (
        <TestDetails test={result.test} />
      ) : null}
    </li>
  );
}

function StatusBadge({ result }: { result: PerEnvResult }) {
  if (!result.testable) {
    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/40 bg-muted/40 font-mono text-[10px] uppercase text-muted-foreground"
      >
        Sem credenciais
      </Badge>
    );
  }
  if (!result.test) return null;
  if (result.test.ok) {
    return (
      <Badge
        variant="outline"
        className="border-success/40 bg-success/10 font-mono text-[10px] uppercase text-success"
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        OK · {result.test.latency_ms ?? '?'}ms
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/40 bg-destructive/10 font-mono text-[10px] uppercase text-destructive"
    >
      <XCircle className="mr-1 h-3 w-3" />
      Falhou
    </Badge>
  );
}

function CredCell({ label, source }: { label: string; source: 'db' | 'env' | 'none' }) {
  const meta = SOURCE_BADGE[source];
  return (
    <div className="flex items-center gap-1.5 rounded border bg-card/50 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className={`ml-auto font-mono text-[9px] uppercase ${meta.cls}`}>
        {meta.label}
      </Badge>
    </div>
  );
}

function TestDetails({ test }: { test: TestResult }) {
  if (test.ok) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        HTTP {test.status ?? 200} · {test.latency_ms ?? '?'}ms
        {test.tested_at && <> · às {fmtTime(test.tested_at)}</>}
      </p>
    );
  }
  const copy = getErrorCopy(
    test.error_kind,
    test.status,
    test.error ?? test.message,
    test.timeout_ms,
  );
  const Icon = copy.icon;
  return (
    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-destructive">
        <Icon className="h-3.5 w-3.5" />
        {copy.title}
        {typeof test.status === 'number' && (
          <span className="font-mono text-[10px] text-muted-foreground">HTTP {test.status}</span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">{copy.hint}</p>
      {test.error && (
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground/80">
          {test.error}
        </p>
      )}
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80">
        <ShieldAlert className="h-3 w-3" />
        {test.tested_at ? `às ${fmtTime(test.tested_at)}` : ''}
        {test.latency_ms !== null && <> · {test.latency_ms}ms</>}
      </p>
    </div>
  );
}
