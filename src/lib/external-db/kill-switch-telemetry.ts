/**
 * Telemetria de hits do kill-switch.
 *
 * Registra (sem PII) quando o front decidiu NÃO chamar uma edge function
 * por causa de um switch OFF. Permite responder:
 *   - Quantas chamadas foram bloqueadas em 1h/24h/7d?
 *   - De quais páginas vinham? (origin = location.pathname)
 *   - Qual operação? (target = tabela ou RPC)
 *
 * Buffering: batches a cada 5s ou 20 eventos, o que vier primeiro.
 * Falha silenciosa em qualquer erro (não bloqueia UX nem retorna ao caller).
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';

export interface KillSwitchHit {
  switch_name: string;
  operation?: string | null;
  target?: string | null;
  origin?: string | null;
  user_role?: 'admin' | 'anon' | 'authenticated';
}

type QueuedHit = KillSwitchHit & { source: 'front'; occurred_at: string };
type KillSwitchHitsClient = {
  from: (table: 'kill_switch_hits') => {
    insert: (rows: QueuedHit[]) => Promise<{ error: { message?: string } | null }>;
  };
};

const BUFFER_MAX_SIZE = 20;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_RETAINED_ON_FAILURE = 100; // proteção contra crescimento ilimitado

let buffer: QueuedHit[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function safeOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Apenas pathname — não capturamos query (pode ter PII)
    return window.location?.pathname ?? null;
  } catch {
    return null;
  }
}

function scheduleFlush(): void {
  if (flushTimer || typeof window === 'undefined') return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const toSend = buffer.splice(0, BUFFER_MAX_SIZE);

  try {
    // Cast: kill_switch_hits foi criada após o último gen-types; quando rodar
    // `supabase gen types` o cast pode ser removido.
    const client = supabase as unknown as KillSwitchHitsClient;
    const { error } = await client.from('kill_switch_hits').insert(toSend);

    if (error) {
      // Em caso de erro, devolve ao buffer (limitado para evitar crescimento)
      logger.warn(
        `[kill-switch-telemetry] flush falhou (${toSend.length} eventos descartados ou re-enfileirados): ${error.message}`,
      );
      buffer = [...toSend.slice(0, MAX_RETAINED_ON_FAILURE - buffer.length), ...buffer];
    }
  } catch (e) {
    logger.warn(`[kill-switch-telemetry] flush erro inesperado: ${toErrorMessage(e)}`);
    // Mesmo tratamento: devolve ao buffer com cap
    buffer = [...toSend.slice(0, MAX_RETAINED_ON_FAILURE - buffer.length), ...buffer];
  } finally {
    flushing = false;
    // Se ainda há eventos enfileirados, agenda novo flush
    if (buffer.length > 0) scheduleFlush();
  }
}

/**
 * Registra um hit do kill-switch. Não bloqueia, não lança.
 */
export function recordKillSwitchHit(hit: KillSwitchHit): void {
  // Proteção contra explosão de memória — descarta silenciosamente se buffer cheio
  if (buffer.length >= MAX_RETAINED_ON_FAILURE) return;

  const queued: QueuedHit = {
    switch_name: hit.switch_name,
    operation: hit.operation ?? null,
    target: hit.target ?? null,
    origin: hit.origin ?? safeOrigin(),
    user_role: hit.user_role ?? 'anon',
    source: 'front',
    occurred_at: new Date().toISOString(),
  };
  buffer.push(queued);

  if (buffer.length >= BUFFER_MAX_SIZE) {
    // Flush imediato quando atinge tamanho
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Força flush — útil em testes e antes de unmount.
 */
export async function flushKillSwitchTelemetry(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}

/**
 * Reset apenas para testes.
 * @internal
 */
export function resetKillSwitchTelemetryForTests(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  buffer = [];
  flushing = false;
}

/**
 * Flush automático antes do usuário sair (best-effort).
 */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => {
    // Sem await — usa sendBeacon path se possível, mas aqui só registra
    // para tentar flush via timer ativo. Em prática, o REST call pode não
    // completar a tempo; o trade-off é aceitável.
    void flush();
  });
}
