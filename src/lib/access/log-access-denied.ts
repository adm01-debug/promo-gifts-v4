/**
 * Registra uma tentativa de acesso negado a uma rota técnica.
 *
 * Estratégia (RLS-safe, sem secrets):
 *  - Insere em `workspace_notifications` no próprio usuário (`user_id = auth.uid()`),
 *    com `category = "access_denied"` e metadata para auditoria.
 *  - Throttle local de 30s por path para evitar flood quando o usuário
 *    fica recarregando a mesma URL.
 *
 * Para auditoria server-side mais forte (ex.: alimentar `admin_audit_log`),
 * use uma edge function com service role — fora do escopo deste helper.
 */
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

const THROTTLE_KEY = 'access_denied_throttle';
const THROTTLE_MS = 30_000;

type ThrottleMap = Record<string, number>;

function loadThrottle(): ThrottleMap {
  try {
    const raw = sessionStorage.getItem(THROTTLE_KEY);
    return raw ? (JSON.parse(raw) as ThrottleMap) : {};
  } catch {
    return {};
  }
}

function saveThrottle(map: ThrottleMap) {
  try {
    sessionStorage.setItem(THROTTLE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export interface LogAccessDeniedInput {
  userId: string;
  blockedPath: string;
  requiredRole: 'admin' | 'dev';
  userRole?: string | null;
}

export async function logAccessDenied(input: LogAccessDeniedInput): Promise<void> {
  const key = `${input.userId}:${input.blockedPath}`;
  const map = loadThrottle();
  const last = map[key];
  if (last && Date.now() - last < THROTTLE_MS) return;
  map[key] = Date.now();
  saveThrottle(map);

  // 1) Notificação visível ao próprio usuário (UX)
  const supabase = await getSupabaseClient();
  const notify = supabase
    .from('workspace_notifications')
    .insert({
      user_id: input.userId,
      title: 'Acesso negado a rota técnica',
      message: `Tentativa de acesso a ${input.blockedPath} bloqueada (requer ${input.requiredRole}).`,
      type: 'warning',
      category: 'access_denied',
      action_url: input.blockedPath,
      metadata: {
        blocked_path: input.blockedPath,
        required_role: input.requiredRole,
        user_role: input.userRole ?? null,
        denied_at: new Date().toISOString(),
        http_status_equivalent: 403,
      },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  // 2) Trilha server-side em admin_audit_log via RPC security-definer
  //    (essencial para tentativas a /admin/telemetria, /admin/seguranca, /admin/conexoes etc.)
  const audit = supabase
    .rpc('log_access_denied', {
      _blocked_path: input.blockedPath,
      _required_role: input.requiredRole,
      _user_role: input.userRole ?? undefined,
      _reason: 'frontend_guard_block',
    })
    .then(
      () => undefined,
      () => undefined,
    );

  await Promise.all([notify, audit]);
}
