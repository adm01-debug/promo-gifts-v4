import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.5';
import { buildPublicCorsHeaders } from '../_shared/cors.ts';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

/**
 * Edge Function: verify-2fa-token
 *
 * Verifica tokens TOTP server-side para operacoes sensiveis de 2FA.
 * O totp_secret NUNCA sai do servidor — corrige BUG-10 (XSS exposure).
 *
 * Actions:
 *   - "verify"  : verifica se token TOTP e valido
 *   - "disable" : verifica token e desabilita 2FA do usuario
 *
 * Body JSON:
 *   {
 *     action: 'verify' | 'disable',
 *     token?: string,           // codigo TOTP 6 digitos (ou backup code)
 *     target_user_id?: string,  // admin operando em outro usuario
 *     is_admin_bypass?: boolean // admin desabilita sem token (propria operacao em outro usuario)
 *   }
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = buildPublicCorsHeaders();

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

Deno.serve(async (req: Request) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'verify-2fa-token', requestId, req });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Autenticacao JWT obrigatoria (verify_jwt: true no deploy)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Token de autenticacao ausente' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) {
    return json({ success: false, error: 'Token invalido ou expirado' }, 401);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    // Guard against non-object bodies (null, array, string, number) — any of
    // these would throw when we do `body.action` below.
    body = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return json({ success: false, error: 'Body JSON invalido' }, 400);
  }

  const action        = body.action as string | undefined;
  const token         = body.token as string | undefined;
  const targetUserId  = body.target_user_id as string | undefined;
  const isAdminBypass = body.is_admin_bypass === true;
  const effectiveUserId = targetUserId || user.id;

  log.info('verify-2fa-token request', { action, effectiveUserId, isAdminBypass });

  // Permissao: operacao em outro usuario requer role admin/dev/supervisor
  if (effectiveUserId !== user.id) {
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes('dev') || roles.includes('supervisor') || roles.includes('admin');

    if (!isAdmin) {
      return json({ success: false, error: 'Permissao insuficiente' }, 403);
    }
  }

  // Buscar settings do usuario alvo server-side — secret permanece no servidor
  const { data: settings, error: settingsErr } = await admin
    .from('user_2fa_settings')
    .select('id, is_enabled, totp_secret, backup_codes')
    .eq('user_id', effectiveUserId)
    .maybeSingle();

  if (settingsErr) {
    console.error('[verify-2fa-token] Erro settings:', settingsErr.message);
    return json({ success: false, error: 'Erro interno' }, 500);
  }

  // ACTION: verify
  if (action === 'verify') {
    if (!settings?.is_enabled) {
      return json({ success: false, error: '2FA nao habilitado' }, 400);
    }
    if (!token) {
      return json({ success: false, error: 'Token obrigatorio' }, 400);
    }
    const valid = verifyTOTP(settings.totp_secret, token)
      || await tryBackupCode(admin, effectiveUserId, settings.backup_codes, token);
    return json(
      valid ? { success: true } : { success: false, error: 'Codigo invalido' },
      valid ? 200 : 401,
    );
  }

  // ACTION: disable
  if (action === 'disable') {
    const bypass = isAdminBypass && effectiveUserId !== user.id;

    if (!bypass) {
      if (!token) {
        return json({ success: false, error: 'Codigo necessario para desabilitar 2FA' }, 400);
      }
      if (!settings?.is_enabled) {
        return json({ success: false, error: '2FA nao esta habilitado' }, 400);
      }
      const valid = verifyTOTP(settings.totp_secret, token)
        || await tryBackupCode(admin, effectiveUserId, settings.backup_codes, token);
      if (!valid) {
        return json({ success: false, error: 'Codigo invalido' }, 401);
      }
    }

    const { error: updateErr } = await admin
      .from('user_2fa_settings')
      .update({ is_enabled: false, totp_secret: null, backup_codes: null, enabled_at: null })
      .eq('user_id', effectiveUserId);

    if (updateErr) {
      console.error('[verify-2fa-token] Erro disable:', updateErr.message);
      return json({ success: false, error: 'Erro ao desabilitar 2FA' }, 500);
    }

    return json({ success: true });
  }

  return json({ success: false, error: `Action desconhecida: ${action}` }, 400);
});

/**
 * Verifica TOTP com janela de +-1 periodo (30s) para tolerar desvio de relogio.
 */
function verifyTOTP(secret: string | null, token: string): boolean {
  if (!secret || !token) return false;
  try {
    const totp = new OTPAuth.TOTP({
      issuer: 'Promo Gifts',
      label: 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.validate({ token: token.trim(), window: 1 }) !== null;
  } catch (e) {
    console.error('[verify-2fa-token] TOTP error:', e);
    return false;
  }
}

/**
 * Tenta consumir um backup code (uso unico).
 * Remove o codigo da lista apos uso bem-sucedido.
 */
async function tryBackupCode(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
  codes: string[] | null,
  token: string,
): Promise<boolean> {
  if (!codes?.length) return false;
  const normalized = token.trim().toUpperCase();
  const idx = codes.findIndex((c) => c.toUpperCase() === normalized);
  if (idx === -1) return false;

  const remaining = codes.filter((_, i) => i !== idx);
  const { error } = await admin
    .from('user_2fa_settings')
    .update({ backup_codes: remaining })
    .eq('user_id', userId);

  if (error) {
    console.error('[verify-2fa-token] backup code consume error:', error.message);
    return false;
  }
  return true;
}
