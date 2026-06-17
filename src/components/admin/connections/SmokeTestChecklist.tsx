/**
 * SmokeTestChecklist — validação manual da pipeline de credenciais.
 *
 * Roda 3 verificações encadeadas contra a edge function `secrets-manager`:
 *   1. Rotação concluída — confirma que `rotate` retorna `previous_suffix → new_suffix`
 *      e que o `masked_suffix` persistido bate com o novo sufixo.
 *   2. Histórico persistente — confirma que `rotation_history` ganhou um registro
 *      novo para o secret testado, com autor e timestamps coerentes.
 *   3. Recarregamento após refresh — força um `list` "frio" e valida que o
 *      `masked_suffix` retornado é o mesmo que foi gravado, garantindo que
 *      sobrevive a um F5 (não é só estado em memória do React).
 *
 * Cada step registra eventos sanitizados via logger para facilitar QA sem
 * expor nomes ou valores de credenciais no console.
 */

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ListChecks,
  PlayCircle,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSecretsManager, type SecretStatus, type RotationHistoryEntry } from '@/hooks/admin';
import { ALLOWED_SECRET_NAMES } from './secretWhitelist';
import { formatMaskedSuffix, normalizeMaskedSuffix } from '@/lib/masked-suffix';
import { logger } from '@/lib/logger';
import { maskSensitiveText } from '@/lib/sensitive-masking';

type StepStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';

interface StepState {
  id: 'rotate' | 'history' | 'reload';
  title: string;
  description: string;
  status: StepStatus;
  detail?: string;
  durationMs?: number;
}

const INITIAL_STEPS: StepState[] = [
  {
    id: 'rotate',
    title: 'Rotação concluída',
    description: 'Substitui o valor e valida o novo sufixo retornado.',
    status: 'idle',
  },
  {
    id: 'history',
    title: 'Histórico persistente',
    description: 'Garante que rotation_history ganhou registro com autor e timestamp.',
    status: 'idle',
  },
  {
    id: 'reload',
    title: 'Recarregamento após refresh',
    description: 'Lista os secrets do banco novamente para confirmar persistência.',
    status: 'idle',
  },
];

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === 'passed')
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === 'skipped') return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
}

function makeTestValue(): string {
  // Random base36 + timestamp, ≥ 16 chars to satisfy validators.
  const rand = Math.random().toString(36).slice(2);
  const stamp = Date.now().toString(36);
  return `smoke_${stamp}_${rand}`.slice(0, 40);
}

function suffixOf(value: string): string {
  return value.slice(-4);
}

function smokeErrorMessage(error: unknown): string {
  return (
    maskSensitiveText(error instanceof Error ? error.message : String(error ?? 'unknown')) ??
    'unknown'
  );
}

interface Props {
  /** All current secrets, used to populate the dropdown of testable names. */
  availableSecrets?: SecretStatus[];
}

export function SmokeTestChecklist({ availableSecrets = [] }: Props) {
  const { list, rotateSecret, getRotationHistory } = useSecretsManager();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [secretName, setSecretName] = useState<string>('');
  const [customValue, setCustomValue] = useState('');

  // Names that exist AND are in the whitelist — only those are safely testable.
  const testableNames = availableSecrets
    .filter((s) => s.has_value && ALLOWED_SECRET_NAMES.has(s.name))
    .map((s) => s.name)
    .sort();

  const updateStep = (id: StepState['id'], patch: Partial<StepState>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const reset = () => setSteps(INITIAL_STEPS);

  const runChecklist = async () => {
    if (!secretName) {
      toast.error('Selecione uma credencial para testar.');
      return;
    }
    setRunning(true);
    reset();

    const newValue = customValue.trim() || makeTestValue();
    const expectedSuffix = suffixOf(newValue);
    const startedAt = new Date();
    const sessionId = `smoke-${Date.now().toString(36)}`;

    logger.debug('[smoke-test] starting', { sessionId, valueLength: newValue.length });

    // STEP 1 — rotate
    updateStep('rotate', { status: 'running' });
    const t1 = performance.now();
    let rotateResult: Awaited<ReturnType<typeof rotateSecret>> | null = null;
    try {
      rotateResult = await rotateSecret(secretName, newValue, `smoke-test ${sessionId}`);
      const took = Math.round(performance.now() - t1);
      if (!rotateResult.ok) {
        updateStep('rotate', {
          status: 'failed',
          detail: rotateResult.error?.message ?? 'Falha desconhecida',
          durationMs: took,
        });

        logger.warn('[smoke-test] step 1 FAILED', {
          sessionId,
          durationMs: took,
          message: smokeErrorMessage(rotateResult.error),
        });
        setRunning(false);
        updateStep('history', { status: 'skipped', detail: 'Pulado (rotação falhou)' });
        updateStep('reload', { status: 'skipped', detail: 'Pulado (rotação falhou)' });
        return;
      }
      const suffixOk = normalizeMaskedSuffix(rotateResult.masked_suffix) === expectedSuffix;
      const lengthOk = (rotateResult.length ?? 0) === newValue.length;
      if (!suffixOk || !lengthOk) {
        updateStep('rotate', {
          status: 'failed',
          detail: `Sufixo esperado ${formatMaskedSuffix(expectedSuffix)}, recebido ${formatMaskedSuffix(rotateResult.masked_suffix)}`,
          durationMs: took,
        });

        logger.warn('[smoke-test] step 1 mismatch', {
          sessionId,
          durationMs: took,
          suffixOk,
          lengthOk,
        });
      } else {
        updateStep('rotate', {
          status: 'passed',
          detail: `previous=${rotateResult.previous_suffix ?? '(env)'} → new=${normalizeMaskedSuffix(rotateResult.masked_suffix)} • ${rotateResult.length} chars`,
          durationMs: took,
        });
        logger.debug('[smoke-test] step 1 OK', { sessionId, durationMs: took });
      }
    } catch (err) {
      const took = Math.round(performance.now() - t1);
      updateStep('rotate', {
        status: 'failed',
        detail: err instanceof Error ? err.message : 'Erro inesperado',
        durationMs: took,
      });

      logger.warn('[smoke-test] step 1 EXCEPTION', {
        sessionId,
        durationMs: took,
        message: smokeErrorMessage(err),
      });
      setRunning(false);
      return;
    }

    // STEP 2 — history persisted
    updateStep('history', { status: 'running' });
    const t2 = performance.now();
    try {
      const entries: RotationHistoryEntry[] = await getRotationHistory(secretName);
      const took = Math.round(performance.now() - t2);
      const matching = entries.find(
        (e) =>
          e.new_suffix === expectedSuffix &&
          new Date(e.rotated_at).getTime() >= startedAt.getTime() - 5000,
      );
      if (!matching) {
        updateStep('history', {
          status: 'failed',
          detail: `Nenhum registro com sufixo ${formatMaskedSuffix(expectedSuffix)} encontrado (${entries.length} entradas vistas).`,
          durationMs: took,
        });

        logger.warn('[smoke-test] step 2 missing entry', {
          sessionId,
          durationMs: took,
          total: entries.length,
        });
      } else {
        const author = matching.rotated_by_email ?? matching.rotated_by ?? 'desconhecido';
        updateStep('history', {
          status: 'passed',
          detail: `Registro #${entries.length} • por ${author} • ${new Date(matching.rotated_at).toLocaleTimeString('pt-BR')}`,
          durationMs: took,
        });
        logger.debug('[smoke-test] step 2 OK', { sessionId, durationMs: took });
      }
    } catch (err) {
      const took = Math.round(performance.now() - t2);
      updateStep('history', {
        status: 'failed',
        detail: err instanceof Error ? err.message : 'Erro ao consultar histórico',
        durationMs: took,
      });

      logger.warn('[smoke-test] step 2 EXCEPTION', {
        sessionId,
        durationMs: took,
        message: smokeErrorMessage(err),
      });
    }

    // STEP 3 — cold reload from DB (simulates F5)
    updateStep('reload', { status: 'running' });
    const t3 = performance.now();
    try {
      const fresh = await list([secretName]);
      const took = Math.round(performance.now() - t3);
      const target = (fresh ?? []).find((s) => s.name === secretName);
      if (!target) {
        updateStep('reload', {
          status: 'failed',
          detail: 'Secret não retornou na listagem após reload.',
          durationMs: took,
        });

        logger.warn('[smoke-test] step 3 missing in list', { sessionId, durationMs: took });
      } else if (normalizeMaskedSuffix(target.masked_suffix) !== expectedSuffix) {
        updateStep('reload', {
          status: 'failed',
          detail: `Sufixo divergente após reload: esperado ${formatMaskedSuffix(expectedSuffix)}, recebido ${formatMaskedSuffix(target.masked_suffix)}`,
          durationMs: took,
        });

        logger.warn('[smoke-test] step 3 suffix mismatch after reload', {
          sessionId,
          durationMs: took,
          source: target.source ?? 'unknown',
        });
      } else {
        const sourceTag = target.source ? ` • source=${target.source}` : '';
        updateStep('reload', {
          status: 'passed',
          detail: `Persistido • ${formatMaskedSuffix(target.masked_suffix)} • ${target.length} chars${sourceTag}`,
          durationMs: took,
        });
        logger.debug('[smoke-test] step 3 OK', {
          sessionId,
          durationMs: took,
          source: target.source ?? 'unknown',
        });
      }
    } catch (err) {
      const took = Math.round(performance.now() - t3);
      updateStep('reload', {
        status: 'failed',
        detail: err instanceof Error ? err.message : 'Erro ao recarregar',
        durationMs: took,
      });

      logger.warn('[smoke-test] step 3 EXCEPTION', {
        sessionId,
        durationMs: took,
        message: smokeErrorMessage(err),
      });
    }

    logger.debug('[smoke-test] finished', { sessionId });
    setRunning(false);
  };

  const copyReport = async () => {
    const lines = [
      `Smoke Test • ${secretName || '(sem credencial)'} • ${new Date().toLocaleString('pt-BR')}`,
      ...steps.map(
        (s) =>
          `• [${s.status.toUpperCase()}] ${s.title}${s.detail ? ` — ${s.detail}` : ''}${s.durationMs ? ` (${s.durationMs}ms)` : ''}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Relatório copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const { summary, allPassed, anyFailed } = useMemo(() => {
    const s = steps.reduce(
      (acc, step) => {
        acc[step.status] = (acc[step.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<StepStatus, number>,
    );
    return { summary: s, allPassed: s.passed === steps.length, anyFailed: (s.failed ?? 0) > 0 };
  }, [steps]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListChecks className="h-4 w-4" />
          Smoke Test
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Checklist de Smoke Test
          </SheetTitle>
          <SheetDescription>
            Valida em sequência: rotação concluída, histórico persistente e recarregamento após
            refresh.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Picker */}
          <div className="space-y-2">
            <Label htmlFor="smoke-secret">Credencial alvo</Label>
            <Select value={secretName} onValueChange={setSecretName} disabled={running}>
              <SelectTrigger id="smoke-secret">
                <SelectValue
                  placeholder={
                    testableNames.length === 0
                      ? 'Nenhuma credencial gravada disponível'
                      : 'Selecione…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {testableNames.map((n) => (
                  <SelectItem key={n} value={n} className="font-mono text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ⚠️ A rotação substitui o valor atual. Use uma credencial de teste ou esteja pronto
              para rotacionar de volta para o valor real.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smoke-value">Valor de teste (opcional)</Label>
            <Input
              id="smoke-value"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Deixe em branco para gerar automaticamente"
              disabled={running}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={runChecklist}
              disabled={running || !secretName}
              className="flex-1 gap-2"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {running ? 'Executando…' : 'Rodar checklist'}
            </Button>
            <Button variant="outline" onClick={copyReport} disabled={running} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
          </div>

          {/* Steps */}
          <ol className="mt-2 space-y-3">
            {steps.map((step, idx) => (
              <li
                key={step.id}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  step.status === 'passed' && 'border-green-500/40 bg-green-500/5',
                  step.status === 'failed' && 'border-destructive/50 bg-destructive/5',
                  step.status === 'running' && 'border-primary/50 bg-primary/5',
                  step.status === 'idle' && 'border-border bg-muted/20',
                  step.status === 'skipped' && 'border-border bg-muted/20 opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <StatusIcon status={step.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                      <h4 className="text-sm font-medium">{step.title}</h4>
                      {typeof step.durationMs === 'number' && (
                        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                          {step.durationMs}ms
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                    {step.detail && (
                      <p
                        className={cn(
                          'mt-1.5 font-mono text-xs',
                          step.status === 'failed' ? 'text-destructive' : 'text-foreground/80',
                        )}
                      >
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Summary */}
          {(summary.passed || summary.failed) && !running && (
            <div
              className={cn(
                'rounded-lg border p-3 text-sm',
                allPassed &&
                  'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
                anyFailed && 'border-destructive/50 bg-destructive/10 text-destructive',
              )}
            >
              {allPassed && (
                <span>✅ Todos os {steps.length} passos passaram. Pipeline saudável.</span>
              )}
              {anyFailed && (
                <span>
                  ❌ {summary.failed} falha{summary.failed > 1 ? 's' : ''} de {steps.length}. Veja o
                  relatório para detalhes sanitizados.
                </span>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
