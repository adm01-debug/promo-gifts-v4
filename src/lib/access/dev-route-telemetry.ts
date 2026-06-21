/**
 * Telemetria de UX para a tela DevRoute (403 — Acesso restrito ao Dev).
 *
 * Estratégia (sem PII, RLS-safe):
 *  - Chama a RPC SECURITY DEFINER `record_dev_route_telemetry` que insere
 *    em `admin_audit_log` com `action='route.ux_event'`, `source='dev-route-ui'`.
 *  - O servidor é a fonte da verdade da sanitização (whitelist de event_type,
 *    clamp de duration, limite de tamanho de path/role). Este helper só monta
 *    o payload mínimo.
 *  - Coalescing local: agrupa o mesmo (event_type, path) em janela de 2s para
 *    evitar duplicatas em re-renders. O rate limit pesado é server-side
 *    (30 eventos/min/usuário).
 *  - Falhas são engolidas: telemetria nunca pode quebrar a UX.
 */
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

export type DevRouteUxEvent =
  | 'abandon'
  | 'back'
  | 'copy_link'
  | 'fallback'
  | 'mail'
  | 'request_access'
  | 'retry'
  | 'view';

interface RecordParams {
  event: DevRouteUxEvent;
  blockedPath: string;
  userRole?: string | null;
  /** Tempo desde o `view` em ms (clamped a [0, 3_600_000] no servidor). */
  durationMs?: number | null;
}

const COALESCE_MS = 2_000;
const recent = new Map<string, number>();

function shouldDrop(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < COALESCE_MS) return true;
  recent.set(key, now);
  // GC simples
  if (recent.size > 64) {
    for (const [k, v] of recent) {
      if (now - v > COALESCE_MS * 4) recent.delete(k);
    }
  }
  return false;
}

export async function recordDevRouteTelemetry(params: RecordParams): Promise<void> {
  const key = `${params.event}:${params.blockedPath}`;
  if (shouldDrop(key)) return;

  try {
    const supabase = await getSupabaseClient();
    await supabase.rpc('record_dev_route_telemetry', {
      _event_type: params.event,
      _blocked_path: params.blockedPath,
      _user_role: params.userRole ?? undefined,
      _duration_ms:
        typeof params.durationMs === 'number' ? Math.round(params.durationMs) : undefined,
    });
  } catch {
    // Telemetria não pode quebrar UX — engole erro silenciosamente.
  }
}
