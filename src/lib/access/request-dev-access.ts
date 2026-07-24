/**
 * Helper para "Solicitar acesso a Dev" a partir de telas de bloqueio (DevRoute).
 *
 * Estratégia (sem expor secrets nem violar RLS):
 *  1. Registra uma notificação pessoal ("pedido enviado") em
 *     `workspace_notifications` (user_id = auth.uid()) — RLS permite.
 *  2. Abre o cliente de e-mail do usuário com `mailto:` pré-preenchido
 *     para o canal técnico configurado.
 *  3. Aplica throttle local (5 min) para evitar spam de cliques.
 *
 * Não há envio server-side aqui — para isso seria preciso uma edge function
 * com service role (`request-dev-access`). Este helper é a camada UX que
 * fecha o loop visual e dá um caminho acionável imediato.
 */

import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

const THROTTLE_KEY_PREFIX = 'dev_access_request_at:';
const THROTTLE_MS = 5 * 60_000;

/** Canal técnico de fallback (mailto). Pode ser sobrescrito via env. */
const DEV_CONTACT_EMAIL =
  (import.meta as { env?: { VITE_DEV_CONTACT_EMAIL?: string } }).env?.VITE_DEV_CONTACT_EMAIL ||
  'dev@promogifts.com.br';

export interface RequestDevAccessInput {
  userId: string;
  userEmail: string | null | undefined;
  /** Path bloqueado (ex.: "/admin/telemetria"). */
  blockedPath: string;
  /** Razão livre opcional digitada pelo usuário. */
  reason?: string;
}

export interface RequestDevAccessResult {
  ok: boolean;
  throttled?: boolean;
  retryInSeconds?: number;
  mailtoUrl?: string;
  error?: string;
}

function throttleKey(userId: string) {
  return `${THROTTLE_KEY_PREFIX}${userId}`;
}

export function getThrottleStatus(userId: string): {
  throttled: boolean;
  retryInSeconds: number;
} {
  try {
    const raw = localStorage.getItem(throttleKey(userId));
    if (!raw) return { throttled: false, retryInSeconds: 0 };
    const last = Number(raw);
    if (!Number.isFinite(last)) return { throttled: false, retryInSeconds: 0 };
    const remaining = THROTTLE_MS - (Date.now() - last);
    if (remaining <= 0) return { throttled: false, retryInSeconds: 0 };
    return { throttled: true, retryInSeconds: Math.ceil(remaining / 1000) };
  } catch {
    return { throttled: false, retryInSeconds: 0 };
  }
}

function buildMailto(input: RequestDevAccessInput): string {
  const subject = `[Promo Gifts] Solicitação de acesso a área técnica — ${input.blockedPath}`;
  const lines = [
    `Solicitante: ${input.userEmail ?? input.userId}`,
    `Rota bloqueada: ${input.blockedPath}`,
    `Quando: ${new Date().toISOString()}`,
    '',
    'Motivo:',
    input.reason?.trim() || '(não informado)',
  ];
  const body = lines.join('\n');
  return `mailto:${DEV_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function requestDevAccess(
  input: RequestDevAccessInput,
): Promise<RequestDevAccessResult> {
  const status = getThrottleStatus(input.userId);
  if (status.throttled) {
    return {
      ok: false,
      throttled: true,
      retryInSeconds: status.retryInSeconds,
    };
  }

  const mailtoUrl = buildMailto(input);

  // Notificação pessoal — RLS permite (user_id = auth.uid()).
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('workspace_notifications').insert({
    user_id: input.userId,
    title: 'Solicitação de acesso a Dev enviada',
    message: `Você solicitou acesso à área técnica ${input.blockedPath}. Aguarde retorno do time responsável.`,
    type: 'info',
    category: 'access_request',
    action_url: input.blockedPath,
    metadata: {
      blocked_path: input.blockedPath,
      reason: input.reason ?? null,
      contact: DEV_CONTACT_EMAIL,
      requested_at: new Date().toISOString(),
    },
  });

  if (error) {
    return { ok: false, error: error.message, mailtoUrl };
  }

  try {
    localStorage.setItem(throttleKey(input.userId), String(Date.now()));
  } catch {
    // ignore
  }

  return { ok: true, mailtoUrl };
}

export const DEV_ACCESS_CONTACT_EMAIL = DEV_CONTACT_EMAIL;
