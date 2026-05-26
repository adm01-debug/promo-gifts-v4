// webhook-inbound: receives external webhooks at /webhook-inbound?slug=<slug>
// Validates HMAC signature using the secret stored in env (referenced by the
// endpoint row), records every event in inbound_webhook_events.
//
// Hardening OPS-002 (auditoria back-end sênior 2026-05-22):
//   • bot-protection por IP no boot do handler (60 req/min, 30min block)
//     — evita DoS por inflação de inbound_webhook_events.
//   • INSERT no inbound_webhook_events só acontece após HMAC validar
//     OU se houver endpoint configurado mas signature inválida.
//
// Idempotency OPS-003:
//   - Verifica se o idempotency_key (ou x-signature-256 se chave ausente) já foi processado.
//   - Retorna 200 (OK, already processed) se for duplicado, evitando re-execução.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';
import { buildPublicCorsHeaders } from '../_shared/cors.ts';
import { parseContract } from '../_shared/contracts/index.ts';
import { WebhookInboundSchemas } from '../_shared/contracts/schemas/webhook-inbound.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';
import { retrySupabaseCall } from '../_shared/retry-backoff.ts';

const corsHeaders = buildPublicCorsHeaders({
  extraAllowHeaders: ['x-signature-256', 'x-event', 'accept-version', 'x-idempotency-key'],
  allowMethods: 'POST, OPTIONS',
});

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'webhook-inbound', requestId, req });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Rate limiting & Bot Protection
  const isInternal = req.headers.get("X-Internal-Call") === "true";
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "never-match";
  const isServiceRole = authHeader.includes(serviceKey) || authHeader.slice(7).trim() === serviceKey;

  if (!(isInternal && isServiceRole)) {
    const protection = await runBotProtection(req, {
      endpoint: 'webhook-inbound',
      maxRequests: 500,
      windowSeconds: 60,
      blockSeconds: 1800,
    }, corsHeaders);
    if (!protection.allowed) {
      log.warn('bot_protection_blocked', { ip: req.headers.get('x-forwarded-for') });
      return protection.blockResponse!;
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') || url.pathname.split('/').filter(Boolean).pop() || '';
    
    if (!slug) {
      return new Response(JSON.stringify({ code: 'missing_slug', message: 'slug ausente' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: endpoint } = await retrySupabaseCall(() => 
      supabase.from('inbound_webhook_endpoints').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()
    );

    if (!endpoint) {
      log.warn('endpoint_not_found', { slug });
      return new Response(JSON.stringify({ code: 'endpoint_not_found', message: 'endpoint não encontrado' }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const rawBody = await req.text();
    const contractResult = await parseContract(req, WebhookInboundSchemas, { corsHeaders, prereadBody: rawBody });
    if (!contractResult.ok) return contractResult.response;

    const { version, data: payloadParsed } = contractResult;
    const signatureHeader = req.headers.get('x-signature-256') || req.headers.get('x-webhook-signature') || '';
    const idempotencyKey = req.headers.get('x-idempotency-key') || 
                          (payloadParsed && typeof payloadParsed === 'object' ? (payloadParsed as any).idempotency_key : null) ||
                          signatureHeader; // fallback to signature if no key provided

    // Check Idempotency
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('inbound_webhook_events')
        .select('id')
        .eq('endpoint_id', endpoint.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        log.info('webhook_duplicate_skipped', { idempotencyKey, endpointId: endpoint.id });
        return new Response(JSON.stringify({ ok: true, received: true, message: 'Already processed' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    const secretRes = await retrySupabaseCall(() => 
      supabase.from('integration_credentials').select('secret_value').eq('secret_name', endpoint.hmac_secret_ref).maybeSingle()
    );
    const secret = secretRes.data?.secret_value || Deno.env.get(endpoint.hmac_secret_ref);

    let signatureValid = false;
    if (secret) {
      const expected = 'sha256=' + (await hmacSign(rawBody, secret));
      const provided = signatureHeader.startsWith('sha256=') ? signatureHeader : 'sha256=' + signatureHeader;
      signatureValid = timingSafeEqual(expected, provided);
    }

    const eventType = req.headers.get('x-event') || (payloadParsed?.event ? String(payloadParsed.event) : 'unknown');
    const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    // Log event in DB
    try {
      await retrySupabaseCall(() => 
        supabase.from('inbound_webhook_events').insert({
          endpoint_id: endpoint.id,
          event_type: eventType,
          payload: payloadParsed,
          signature_valid: signatureValid,
          processed: signatureValid,
          ip_address: sourceIp,
          error_message: signatureValid ? null : 'HMAC inválido ou ausente',
          contract_version: version,
          idempotency_key: idempotencyKey,
        }).select().single()
      );
    } catch (insertError: any) {
      // If it's a duplicate key error, we treat it as already processed (idempotency)
      if (insertError.code === '23505') { // PostgreSQL unique_violation
        log.info('webhook_duplicate_race_skipped', { idempotencyKey });
        return new Response(JSON.stringify({ ok: true, received: true, message: 'Already processed' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      log.error('db_insert_failed', { error: insertError });
      throw insertError;
    }

    // Update endpoint stats
    try {
      await retrySupabaseCall(() => 
        supabase.rpc('increment_webhook_stats', { 
          p_endpoint_id: endpoint.id, 
          p_is_invalid: !signatureValid 
        })
      );
    } catch (statsError) {
      log.warn('stats_update_failed', { error: statsError });
      // Non-critical, continue
    }

    log.info('webhook_received', { slug, eventType, signatureValid });

    if (!signatureValid) {
      return new Response(JSON.stringify({ code: 'invalid_signature', message: 'Assinatura inválida' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return log.respond(new Response(JSON.stringify({ ok: true, received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }));

  } catch (err) {
    log.error('unhandled_error', { error: err });
    return new Response(JSON.stringify({ code: 'internal_error', message: 'Erro interno' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});