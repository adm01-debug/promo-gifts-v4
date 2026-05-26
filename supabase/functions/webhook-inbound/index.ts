// webhook-inbound: receives external webhooks at /webhook-inbound?slug=<slug>
// Validates HMAC signature using the secret stored in env (referenced by the
// endpoint row), records every event in inbound_webhook_events.
//
// Hardening OPS-002 (auditoria back-end sênior 2026-05-22):
//   • bot-protection por IP no boot do handler (500 req/min, 30min block)
//     — evita DoS por inflação de inbound_webhook_events.
//   • INSERT no inbound_webhook_events só acontece após HMAC validar
//     OU se houver endpoint configurado mas signature inválida (registro
//     forense limitado a callers que conhecem ao menos o slug).
//
// Contract validation:
//   - v1 = passthrough (compat com produção) APENAS para emissores legados allowlisted.
//   - v2 = envelope strict { event, occurred_at, data, idempotency_key? }
//   Cliente seleciona via header `accept-version: 2` ou `?v=2`.
//   v1 será descontinuada em 2026-06-30; resposta inclui headers Deprecation/Sunset
//   + warning explícito.
//
// Idempotency OPS-003 (2026-05-26):
//   - Idempotency key vem de (em ordem): header `x-idempotency-key`,
//     payload.idempotency_key (v2), ou hash da assinatura (fallback).
//   - Quando key reconhecida como já processada, retorna 200 com flag duplicate=true
//     sem reexecutar nada.
//   - Índice único parcial (endpoint_id, idempotency_key) garante atomicidade;
//     race condition durante o INSERT é capturada via 23505 e tratada como duplicate.

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
  extraAllowHeaders: ['x-signature-256', 'x-event', 'accept-version', 'x-idempotency-key', 'x-webhook-issuer'],
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

function readRequestedVersion(req: Request): string | null {
  const headerVal = req.headers.get('accept-version');
  if (headerVal) return headerVal.replace(/^v/i, '').split('.')[0].trim();
  try {
    const qv = new URL(req.url).searchParams.get('v');
    if (qv) return qv.replace(/^v/i, '').split('.')[0].trim();
  } catch {
    // no-op
  }
  return null;
}

function parseAllowlist(): Set<string> {
  const raw = Deno.env.get('WEBHOOK_INBOUND_V1_ALLOWLIST') ?? '';
  return new Set(
    raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

/** Resolve a idempotency key da request, com fallback ordenado. */
function resolveIdempotencyKey(req: Request, payload: unknown, signatureHeader: string): string | null {
  // 1) Header explícito
  const headerKey = req.headers.get('x-idempotency-key')?.trim();
  if (headerKey && headerKey.length >= 8 && headerKey.length <= 256) return headerKey;

  // 2) Campo no envelope v2
  if (payload && typeof payload === 'object' && 'idempotency_key' in payload) {
    const k = String((payload as { idempotency_key?: unknown }).idempotency_key ?? '').trim();
    if (k && k.length >= 8 && k.length <= 256) return k;
  }

  // 3) Fallback: assinatura HMAC (mesma assinatura ⇒ mesmo payload). Só funciona se houver.
  if (signatureHeader && signatureHeader.length >= 16) {
    return `sig:${signatureHeader.replace(/^sha256=/, '')}`;
  }
  return null;
}

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'webhook-inbound', requestId, req });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // OPS-002: rate-limit anti-DoS por IP antes de qualquer trabalho de DB.
  // Bypass para chamadas internas autenticadas com service_role (load tests, orquestração).
  const isInternal = req.headers.get('X-Internal-Call') === 'true';
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'never-match';
  const isServiceRole =
    authHeader.includes(serviceKey) || authHeader.slice(7).trim() === serviceKey;

  if (!(isInternal && isServiceRole)) {
    const protection = await runBotProtection(
      req,
      {
        endpoint: 'webhook-inbound',
        maxRequests: 500,
        windowSeconds: 60,
        blockSeconds: 1800,
        allowSearchBots: false,
      },
      corsHeaders,
    );
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
    const slug =
      url.searchParams.get('slug') || url.pathname.split('/').filter(Boolean).pop() || '';
    if (!slug) {
      return log.respond(
        new Response(
          JSON.stringify({ code: 'missing_slug', message: 'slug ausente', fields: [] }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        ),
      );
    }

    const { data: endpoint } = await retrySupabaseCall(() =>
      supabase
        .from('inbound_webhook_endpoints')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle(),
    );

    if (!endpoint) {
      log.warn('endpoint_not_found', { slug });
      return log.respond(
        new Response(
          JSON.stringify({
            code: 'endpoint_not_found',
            message: 'endpoint não encontrado',
            fields: [],
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        ),
      );
    }

    // CRÍTICO: ler raw body UMA vez (HMAC precisa do raw exato; parseContract
    // recebe via prereadBody pra não tentar consumir o stream novamente).
    const rawBody = await req.text();

    // Validação de contrato (v1 = passthrough, v2 = envelope strict).
    const contractResult = await parseContract(req, WebhookInboundSchemas, {
      corsHeaders,
      prereadBody: rawBody,
    });
    if (!contractResult.ok) return contractResult.response;
    const { version, data: payloadParsed, responseHeaders } = contractResult;

    const requestedVersion = readRequestedVersion(req);
    const isDefaultVersion = !requestedVersion;
    const issuer = req.headers.get('x-webhook-issuer')?.trim() || slug;

    const v1CompatEnabled =
      (Deno.env.get('WEBHOOK_INBOUND_V1_COMPAT_ENABLED') ?? 'false').toLowerCase() === 'true';
    const v1Allowlist = parseAllowlist();
    const v1AllowedIssuer = v1Allowlist.has(issuer) || v1Allowlist.has(slug);

    // Métrica estruturada de adoção de contrato (preserva observabilidade existente)
    console.info(
      JSON.stringify({
        metric: 'webhook_inbound_contract_version_adoption',
        endpoint: slug,
        issuer,
        contract_version: version,
        is_default_version: isDefaultVersion,
        requested_version: requestedVersion ?? 'default',
        request_id: requestId,
      }),
    );

    if (version === '1' && (!v1CompatEnabled || !v1AllowedIssuer)) {
      log.warn('legacy_version_blocked', { issuer, v1CompatEnabled, v1AllowedIssuer });
      return log.respond(
        new Response(
          JSON.stringify({
            code: 'legacy_version_blocked',
            message:
              'v1 temporariamente restrita: solicite migração para envelope v2 ou peça allowlist de emissor legado.',
            fields: ['accept-version'],
          }),
          {
            status: 426,
            headers: {
              ...corsHeaders,
              ...responseHeaders,
              'Content-Type': 'application/json',
              Warning: '299 - "Webhook v1 está em sunset (2026-06-30). Use v2 envelope."',
            },
          },
        ),
      );
    }

    const signatureHeader =
      req.headers.get('x-signature-256') || req.headers.get('x-webhook-signature') || '';

    // OPS-003: idempotency check ANTES de qualquer trabalho pesado.
    const idempotencyKey = resolveIdempotencyKey(req, payloadParsed, signatureHeader);
    if (idempotencyKey) {
      const { data: existing } = await retrySupabaseCall(() =>
        supabase
          .from('inbound_webhook_events')
          .select('id, signature_valid, created_at')
          .eq('endpoint_id', endpoint.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle(),
      );

      if (existing) {
        log.info('webhook_duplicate_skipped', {
          idempotency_key: idempotencyKey,
          endpoint_id: endpoint.id,
          original_event_id: existing.id,
        });
        const okHeaders: Record<string, string> = {
          ...corsHeaders,
          ...responseHeaders,
          'Content-Type': 'application/json',
        };
        if (version === '1') {
          okHeaders['Warning'] =
            '299 - "Webhook v1 deprecado; sunset em 2026-06-30. Migre para v2."';
        }
        return log.respond(
          new Response(
            JSON.stringify({
              ok: true,
              received: true,
              duplicate: true,
              message: 'Already processed (idempotent replay)',
              original_event_id: existing.id,
            }),
            { headers: okHeaders },
          ),
        );
      }
    }

    const eventType =
      req.headers.get('x-event') ||
      (typeof payloadParsed === 'object' && payloadParsed !== null && 'event' in payloadParsed
        ? String((payloadParsed as { event: unknown }).event)
        : 'unknown');
    const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    const { data: secretRow } = await retrySupabaseCall(() =>
      supabase
        .from('integration_credentials')
        .select('secret_value')
        .eq('secret_name', endpoint.hmac_secret_ref)
        .maybeSingle(),
    );
    const secret = secretRow?.secret_value || Deno.env.get(endpoint.hmac_secret_ref);

    let signatureValid = false;
    if (secret) {
      const expected = 'sha256=' + (await hmacSign(rawBody, secret));
      const provided = signatureHeader.startsWith('sha256=')
        ? signatureHeader
        : 'sha256=' + signatureHeader;
      signatureValid = timingSafeEqual(expected, provided);
    }

    // INSERT do evento. Colunas reais do schema (corrigidas):
    //   - ip_address (não source_ip)
    //   - error_message (não error)
    // Captura 23505 (unique_violation) caso race-condition durante insert idempotente.
    try {
      const { error: insertError } = await supabase.from('inbound_webhook_events').insert({
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload: payloadParsed,
        signature_valid: signatureValid,
        processed: signatureValid,
        ip_address: sourceIp,
        error_message: signatureValid ? null : 'HMAC inválido ou ausente',
        contract_version: version,
        idempotency_key: idempotencyKey,
      });

      if (insertError) {
        // PostgreSQL 23505 = unique_violation → outro request paralelo já registrou
        if ((insertError as { code?: string }).code === '23505') {
          log.info('webhook_duplicate_race_skipped', {
            idempotency_key: idempotencyKey,
            endpoint_id: endpoint.id,
          });
          return log.respond(
            new Response(
              JSON.stringify({
                ok: true,
                received: true,
                duplicate: true,
                message: 'Already processed (race condition resolved)',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            ),
          );
        }
        log.error('db_insert_failed', { error: insertError });
        throw insertError;
      }
    } catch (insertErr) {
      log.error('db_insert_unexpected_error', { error: insertErr });
      throw insertErr;
    }

    // Atualização atômica de stats via RPC (substitui o UPDATE direto que sofria
    // de race condition em ambiente concorrente). Falha é não-crítica.
    try {
      await retrySupabaseCall(() =>
        supabase.rpc('increment_webhook_stats', {
          p_endpoint_id: endpoint.id,
          p_is_invalid: !signatureValid,
        }),
      );
    } catch (statsError) {
      log.warn('stats_update_failed', { error: statsError });
      // Não crítico — evento já foi gravado.
    }

    const okHeaders: Record<string, string> = {
      ...corsHeaders,
      ...responseHeaders,
      'Content-Type': 'application/json',
    };
    if (version === '1') {
      okHeaders['Warning'] = '299 - "Webhook v1 deprecado; sunset em 2026-06-30. Migre para v2."';
    }

    if (!signatureValid) {
      log.warn('invalid_signature', { slug, eventType });
      return log.respond(
        new Response(
          JSON.stringify({ code: 'invalid_signature', message: 'Assinatura inválida', fields: [] }),
          { status: 401, headers: okHeaders },
        ),
      );
    }

    log.info('webhook_received', { slug, eventType, contract_version: version });
    return log.respond(
      new Response(
        JSON.stringify({
          ok: true,
          received: true,
          warning:
            version === '1'
              ? 'Webhook v1 deprecado; sunset em 2026-06-30. Migre para envelope v2.'
              : undefined,
        }),
        { headers: okHeaders },
      ),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    log.error('unhandled_error', { error: err });
    return log.respond(
      new Response(
        JSON.stringify({ code: 'internal_error', message: msg, fields: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    );
  }
});
