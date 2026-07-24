/**
 * check-login — Edge Function pública (verify_jwt: false)
 *
 * Chamada ANTES de supabase.auth.signIn() para verificar se
 * o login deve ser permitido segundo as regras de
 * access_security_settings (IP whitelist, city whitelist, lockout).
 *
 * Delega toda a lógica para fn_check_login_allowed() no Postgres
 * (SECURITY DEFINER — acessa access_security_settings mesmo sem JWT).
 *
 * POST /functions/v1/check-login
 * Body: { email: string, city?: string }
 * Response 200: { allowed: true,  reason: 'allowed', ... }
 * Response 403: { allowed: false, reason: string, blocked_until?: string }
 *
 * Implantada em 2026-06-15 como Peça 4 do enforcement de segurança.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { buildPublicCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

const CORS = buildPublicCorsHeaders({ allowMethods: 'POST, OPTIONS' });

// ── Extrai IP real: Cloudflare → X-Forwarded-For → X-Real-IP ───────
function extractIP(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

Deno.serve(async (req: Request) => {
  const __reqId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'check-login', requestId: __reqId, req });
  log.info('request_start');
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* body vazio — ok */ }

    const email      = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const city       = typeof body.city  === 'string' ? body.city  : null;
    const ipAddress  = extractIP(req);
    const userAgent  = req.headers.get('user-agent') ?? null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'invalid_email' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.rpc('fn_check_login_allowed', {
      p_email:      email,
      p_ip_address: ipAddress,
      p_city:       city,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('[check-login] RPC error:', error.message);
      return new Response(
        JSON.stringify({ allowed: true, reason: 'security_check_unavailable' }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    const allowed = row?.allowed ?? true;

    return new Response(
      JSON.stringify({
        allowed,
        reason:        row?.reason        ?? 'unknown',
        blocked_until: row?.blocked_until ?? null,
        check_details: row?.check_details ?? {},
      }),
      { status: allowed ? 200 : 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[check-login] unhandled error:', err);
    return new Response(
      JSON.stringify({ allowed: true, reason: 'internal_error_fail_open' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json', 'X-Request-Id': __reqId } }
    );
  }
});
