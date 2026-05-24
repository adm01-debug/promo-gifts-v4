import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type TelemetryEventType = 'error' | 'performance' | 'ux_action' | 'api_fail';

export interface TelemetryPayload {
  event_type: TelemetryEventType;
  name: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

class TelemetryService {
  private sessionId: string;

  constructor() {
    this.sessionId = Math.random().toString(36).substring(2, 15);
  }

  async log(payload: TelemetryPayload) {
    try {
      // Don't log in development to save DB space, unless explicitly needed
      if (import.meta.env.DEV) {
        console.log(`[Telemetry] ${payload.event_type}: ${payload.name}`, payload.metadata);
        // return; // Uncomment to disable dev logging
      }

      const { error } = await supabase.from('frontend_telemetry').insert({
        event_type: payload.event_type,
        name: payload.name,
        duration_ms: payload.duration_ms,
        metadata: (payload.metadata || {}) as unknown as Json,
        url: window.location.href,
        user_agent: navigator.userAgent,
        session_id: this.sessionId,
      });

      if (error) {
        console.warn('[Telemetry] Error inserting log:', error);
      }
    } catch (e) {
      console.error('[Telemetry] Critical failure:', e);
    }
  }

  async logError(name: string, error: unknown, metadata?: Record<string, unknown>) {
    // Captura stack trace detalhado para facilitar depuração de crashes
    const errObj = error instanceof Error ? error : null;
    const stack = errObj?.stack || new Error().stack;

    return this.log({
      event_type: 'error',
      name,
      metadata: {
        message: errObj?.message || String(error),
        stack,
        context_data: metadata,
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logPerformance(name: string, duration_ms: number, metadata?: Record<string, unknown>) {
    // Only log outliers (e.g. > 1s for routes, > 500ms for themes)
    if (duration_ms < 100) return;

    return this.log({
      event_type: 'performance',
      name,
      duration_ms,
      metadata,
    });
  }

  async logUXAction(name: string, metadata?: Record<string, unknown>) {
    return this.log({
      event_type: 'ux_action',
      name,
      metadata,
    });
  }
}

export const telemetryService = new TelemetryService();
