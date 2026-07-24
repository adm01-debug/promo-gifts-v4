/**
 * Telemetria client-side em memória para chamadas ao secrets-manager.
 *
 * - Sem persistência: zera ao recarregar.
 * - Custo zero quando não há subscribers (mesmo padrão do bridgeCallMetrics).
 * - Buffer circular curto (últimas N chamadas).
 *
 * Consumido pelo painel "Logs Edge Functions" em /admin/telemetria.
 */

export interface SecretsManagerCallSample {
  id: number;
  ts: number;
  /** Ação invocada: list | set | rotate | rotation_history | refresh_cache | delete | status */
  action: string;
  /** Nome do secret quando aplicável (mascarado: prefixo apenas). */
  target?: string;
  durationMs: number;
  ok: boolean;
  status?: number;
  errorMessage?: string;
  errorCode?: string;
  /** Correlation-id propagado via X-Request-Id. */
  requestId?: string;
}

const MAX_SAMPLES = 200;

let nextId = 1;
const samples: SecretsManagerCallSample[] = [];
const listeners = new Set<() => void>();

const EMIT_THROTTLE_MS = 100;
let emitScheduled = false;

function emit() {
  if (listeners.size === 0) return;
  if (emitScheduled) return;
  emitScheduled = true;
  setTimeout(() => {
    emitScheduled = false;
    for (const l of listeners) {
      try {
        l();
      } catch {
        /* noop */
      }
    }
  }, EMIT_THROTTLE_MS);
}

export function recordSecretsManagerCall(
  sample: Omit<SecretsManagerCallSample, 'id' | 'ts'> & { ts?: number },
): void {
  const entry: SecretsManagerCallSample = {
    id: nextId++,
    ts: sample.ts ?? Date.now(),
    action: sample.action,
    target: sample.target,
    durationMs: Math.max(0, Math.round(sample.durationMs)),
    ok: sample.ok,
    status: sample.status,
    errorMessage: sample.errorMessage,
    errorCode: sample.errorCode,
    requestId: sample.requestId,
  };
  samples.push(entry);
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  emit();
}

export function getSecretsManagerSamples(): readonly SecretsManagerCallSample[] {
  return samples;
}

export function subscribeSecretsManagerCalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearSecretsManagerSamples(): void {
  samples.length = 0;
  emit();
}
