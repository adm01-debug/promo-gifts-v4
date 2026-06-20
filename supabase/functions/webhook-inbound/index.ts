// webhook-inbound: receives external webhooks at /functions/v1/webhook-inbound
import { getCorsHeaders } from '../_shared/cors.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const WEBHOOK_SOURCES = [
  'bitrix24',
  'n8n',
  'evolution-api',
  'zapier',
  'make',
  'custom',
] as const;
type WebhookSource = typeof WEBHOOK_SOURCES[number];

interface WebhookPayload {
  source?: WebhookSource;
  event?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

// SEC-WHS (2026-06-18): verificação OPT-IN de assinatura HMAC-SHA256.
// Threat model: este endpoint é público (verify_jwt=false) e recebe webhooks de
// bitrix24/n8n/evolution-api/zapier/make. Sem assinatura, qualquer um que alcance
// a URL pode injetar eventos forjados em `webhook_events`.
// Compat (gap E1): a verificação só é ENFORÇADA quando o segredo
// WEBHOOK_INBOUND_SIGNING_SECRET está presente no ambiente da função. Enquanto não
// estiver setado, o comportamento é idêntico ao anterior (fail-open) — não quebra os
// emissores atuais. Depois de configurar o segredo e fazer os emissores assinarem o
// corpo CRU com HMAC-SHA256 (header `X-Webhook-Signature: sha256=<hex>`), requisições
// sem assinatura válida passam a ser rejeitadas (401).
// Bypass: chamadas internas autenticadas com service_role (mesma regra do rate-limit).
function hexFromBytes(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparação hex em tempo constante (mitiga timing attacks).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  // Normaliza prefixo sha256= de forma case-insensitive (SHA256= de alguns emissores).
  const sigLower = signatureHeader.toLowerCase();
  const provided = sigLower.startsWith('sha256=')
    ? signatureHeader.slice(7).trim()
    : signatureHeader.trim();
  if (!provided) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    return timingSafeEqualHex(hexFromBytes(mac).toLowerCase(), provided.toLowerCase());
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  // OPS-002: rate-limit anti-DoS por IP antes de qualquer trabalho de DB.
  // Bypass para chamadas internas autenticadas com service_role (load tests, orquestração).
  const isInternal = req.headers.get('X-Internal-Call') === 'true';
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'never-match';

  // BUG-A07 FIX (26/05/2026): authHeader.includes(serviceKey) permitia bypass por substring.
  // Ex: token "crafted-prefix-SERVICE_KEY-suffix" passava na validação.
  // Fix: comparação exata após strip do prefixo "Bearer ".
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const isServiceRole = bearerToken === serviceKey;

  if (!(isInternal && isServiceRole)) {
    const protection = await runBotProtection(
      req,
      {
        endpoint: 'webhook-inbound',
        maxRequests: 500,
        windowSeconds: 60,
        blockSeconds: 1800,
      },
      cors,
    );
    if (!protection.allowed) return protection.blockResponse!;
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // SEC-WHS: lê o corpo CRU uma única vez (necessário p/ HMAC sobre os bytes exatos).
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Unable to read request body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // SEC-WHS: enforce de assinatura SOMENTE quando o segredo está configurado (opt-in).
  const signingSecret = Deno.env.get('WEBHOOK_INBOUND_SIGNING_SECRET') || '';
  if (signingSecret && !(isInternal && isServiceRole)) {
    const provided = req.headers.get('X-Webhook-Signature')
      || req.headers.get('x-webhook-signature')
      || '';
    const valid = await verifyWebhookSignature(rawBody, provided, signingSecret);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing webhook signature' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }
  }

  let body: WebhookPayload;
  try {
    const parsed = JSON.parse(rawBody);
    // Guard: null / array / primitive bodies would throw when we access
    // body.source below — treat them as an empty object so the handler
    // proceeds with safe defaults (source='custom', event='unknown').
    body = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      ? (parsed as WebhookPayload)
      : ({} as WebhookPayload);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const source = body.source ?? 'custom';
  const event = body.event ?? 'unknown';

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Verifica se a compatibilidade v1 está habilitada
  const { data: compatRow } = await adminClient
    .from('integration_credentials')
    .select('secret_value')
    .eq('secret_name', 'WEBHOOK_INBOUND_V1_COMPAT_ENABLED')
    .maybeSingle();

  const v1CompatEnabled = compatRow?.secret_value === 'true';

  if (!v1CompatEnabled) {
    // Modo padrão: registra e retorna
    const { error: insertError } = await adminClient
      .from('webhook_events')
      .insert({
        source,
        event_type: event,
        payload: body.data ?? {},
        metadata: body.metadata ?? {},
        received_at: new Date().toISOString(),
        processed: false,
      });

    if (insertError) {
      console.error('[webhook-inbound] insert error:', insertError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to store webhook event', details: insertError.message }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const { error: statsErr } = await adminClient.rpc('increment_webhook_stats', {
      p_source: source,
      p_event: event,
    });
    if (statsErr) console.warn('[webhook-inbound] increment_webhook_stats non-fatal:', statsErr);

    return new Response(
      JSON.stringify({ ok: true, source, event, queued: true }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Modo v1 compat: encaminha para processamento legado
  const { data: allowlistRow } = await adminClient
    .from('integration_credentials')
    .select('secret_value')
    .eq('secret_name', 'WEBHOOK_INBOUND_V1_ALLOWLIST')
    .maybeSingle();

  const allowlist: string[] = allowlistRow?.secret_value
    ? JSON.parse(allowlistRow.secret_value)
    : [];

  if (allowlist.length > 0 && !allowlist.includes(source)) {
    return new Response(
      JSON.stringify({ error: `Source '${source}' not in allowlist` }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Processa inline (v1 compat path)
  return new Response(
    JSON.stringify({ ok: true, source, event, compat_v1: true }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
