import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import type { Json } from '@/integrations/supabase/types';

import { logger } from '@/lib/logger';
export type TelemetryEventType = 'api_fail' | 'error' | 'performance' | 'ux_action';

export interface TelemetryPayload {
  event_type: TelemetryEventType;
  name: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Limites de batch e sampling — Bug P3-03 da auditoria 24/05/2026.
 *
 * Estado anterior: 1 INSERT por evento (4545 rows / 3 dias = ~63 rows/h normal,
 * mas em incidentes pode disparar dezenas por segundo). Sem batching, cada
 * evento gera round-trip HTTP + RLS check + write — muito caro em pico.
 *
 * Estratégia agora:
 *  1. Buffer in-memory com flush a cada FLUSH_INTERVAL_MS OU BATCH_SIZE eventos
 *  2. Sampling configurável por event_type (errors e api_fail nunca samplam)
 *  3. Flush forçado no pagehide/beforeunload via navigator.sendBeacon-like
 */
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
const SAMPLE_RATE: Record<TelemetryEventType, number> = {
  error: 1.0, // 100% — todo erro importa
  api_fail: 1.0, // 100% — falhas de API são críticas
  performance: 0.1, // 10% — performance é estatística
  ux_action: 0.2, // 20% — ações de UX são frequentes mas amostradas
};

const MAX_NAME_LENGTH = 256;
const MAX_URL_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 1024;
const MAX_METADATA_JSON_LENGTH = 7800;

function truncateText(value: string, maxLength: number, fallback = ''): string {
  const normalized = value.trim() || fallback;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function toBoundedJson(metadata: Record<string, unknown> | undefined): Json {
  const payload = metadata ?? {};
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_METADATA_JSON_LENGTH) return payload as Json;

  return {
    truncated: true,
    original_size: serialized.length,
  } as Json;
}

function normalizeDuration(durationMs: number | undefined): number | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs)) return undefined;
  return Math.min(Math.max(durationMs, 0), 600000);
}

/** Formato snake_case que o PostgREST/Supabase espera */
interface BufferedEvent {
  event_type: TelemetryEventType;
  name: string;
  duration_ms?: number;
  metadata?: Json;
  url: string;
  user_agent: string;
  session_id: string;
}

class TelemetryService {
  private readonly sessionId: string;
  private buffer: BufferedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor() {
    this.sessionId = Math.random().toString(36).substring(2, 15);
    if (typeof window !== 'undefined') {
      // Flush no fechamento da página/aba — eventos pendentes não somem
      window.addEventListener('pagehide', () => {
        void this.flush(true);
      });
      window.addEventListener('beforeunload', () => {
        void this.flush(true);
      });
    }
  }

  private shouldSample(eventType: TelemetryEventType): boolean {
    const rate = SAMPLE_RATE[eventType] ?? 1.0;
    if (rate >= 1) return true;
    return Math.random() < rate;
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private async flush(force = false): Promise<void> {
    if (this.flushing) return;
    if (this.buffer.length === 0) return;
    if (!force && this.buffer.length < BATCH_SIZE && this.flushTimer) {
      // ainda esperando o timer ou batch encher
      return;
    }

    this.flushing = true;
    const batch = this.buffer.splice(0, BATCH_SIZE);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('frontend_telemetry').insert(batch);
      if (error) {
        // Não re-bufferiza pra evitar loop infinito se erro for RLS/quota
        logger.warn('[Telemetry] Batch insert failed:', error.message);
      }
    } catch (e) {
      logger.error('[Telemetry] Critical batch failure:', e);
    } finally {
      this.flushing = false;
      // Se ainda tem coisa no buffer, agenda próxima
      if (this.buffer.length > 0) this.scheduleFlush();
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async log(payload: TelemetryPayload): Promise<void> {
    try {
      if (import.meta.env.DEV) {
        logger.warn(`[Telemetry] ${payload.event_type}: ${payload.name}`, payload.metadata);
      }

      if (!this.shouldSample(payload.event_type)) return;

      this.buffer.push({
        event_type: payload.event_type,
        name: truncateText(payload.name, MAX_NAME_LENGTH, 'unnamed_event'),
        duration_ms: normalizeDuration(payload.durationMs),
        metadata: toBoundedJson(payload.metadata),
        url: truncateText(
          typeof window !== 'undefined' ? window.location.href : '',
          MAX_URL_LENGTH,
        ),
        user_agent: truncateText(
          typeof navigator !== 'undefined' ? navigator.userAgent : '',
          MAX_USER_AGENT_LENGTH,
        ),
        session_id: this.sessionId,
      });

      if (this.buffer.length >= BATCH_SIZE) {
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch (e) {
      // Telemetria nunca deve quebrar o app
      logger.error('[Telemetry] Critical failure:', e);
    }
  }

  async logError(name: string, error: unknown, metadata?: Record<string, unknown>): Promise<void> {
    const errObj =
      error instanceof Error
        ? error
        : typeof error === 'object' && error !== null
          ? (error as Record<string, unknown>)
          : { message: String(error) };
    const stack = (errObj as { stack?: string }).stack || new Error().stack;
    return this.log({
      event_type: 'error',
      name,
      metadata: {
        message: error instanceof Error ? error.message : String(error),
        stack,
        context_data: metadata,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logPerformance(
    name: string,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Mantém o threshold (só >= 100ms importa) ANTES do sampling
    if (durationMs < 100) return;
    return this.log({
      event_type: 'performance',
      name,
      durationMs,
      metadata,
    });
  }

  async logUXAction(name: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log({
      event_type: 'ux_action',
      name,
      metadata,
    });
  }

  /** Para tests: limpa buffer e timers sem flush. */
  __reset(): void {
    this.buffer = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Para tests: força flush imediato. */
  async __flushNow(): Promise<void> {
    return this.flush(true);
  }
}

export const telemetryService = new TelemetryService();
