// supabase/functions/receive-quote-sync/index.ts (Promo Champions)
// Recebe webhook `quote.sent` do PromoGifts.
// - Valida HMAC-SHA256 (header x-webhook-signature) com timing-safe compare
// - Dedupe por correlation_key em public.webhook_inbound_dedupe
// - Upsert idempotente em public.quotes_inbound por quote_id
// - Loga TODA chamada em public.webhook_inbound_log
//
// verify_jwt = false — auth é 100% via HMAC.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-event, x-correlation-key, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id',
};

const PayloadSchema = z.object({
  event: z.string().min(1),
  correlation_key: z.string().min(1).max(256),
  payload: z.object({
    quote_id: z.string().uuid(),
    quote_number: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
    client_name: z.string().nullable().optional(),
    total: z.number().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    seller_email: z.string().nullable().optional(),
  }).passthrough(),
});

function json(status: number, body: unknown, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
  });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'x-request-id': requestId } });
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' }, requestId);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const logAndReturn = async (
    outcome: string,
    status: number,
    body: Record<string, unknown>,
    meta?: { correlation_key?: string; event?: string; payloadSize?: number; error?: string },
  ) => {
    try {
      await supabase.from('webhook_inbound_log').insert({
        source: 'promogifts',
        event: meta?.event ?? null,
        correlation_key: meta?.correlation_key ?? null,
        outcome,
        http_status: status,
        request_id: requestId,
        error_message: meta?.error ?? null,
        payload_size: meta?.payloadSize ?? null,
      });
    } catch (_e) {
      // log-and-forget
    }
    return json(status, body, requestId);
  };

  // 1) HMAC — precede qualquer parse pra evitar oracle
  const secret = Deno.env.get('PROMOGIFTS_WEBHOOK_SECRET');
  if (!secret) {
    return await logAndReturn(
      'hmac_missing',
      401,
      {
        ok: false,
        error: 'secret_not_configured',
        hint: 'Cadastre o secret PROMOGIFTS_WEBHOOK_SECRET nas Edge Function Secrets deste projeto. Ele deve ter o mesmo valor de PROMO_CHAMPIONS_WEBHOOK_SECRET no projeto PromoGifts.',
        request_id: requestId,
      },
      { error: 'PROMOGIFTS_WEBHOOK_SECRET não configurado' },
    );
  }

  const providedSig = req.headers.get('x-webhook-signature');
  if (!providedSig) {
    return await logAndReturn(
      'hmac_missing',
      401,
      {
        ok: false,
        error: 'hmac_missing',
        hint: 'Header x-webhook-signature ausente. O emissor (PromoGifts) precisa enviar o HMAC-SHA256 hex do body.',
        request_id: requestId,
      },
    );
  }

  const rawBody = await req.text();
  const expectedSig = await hmacSha256Hex(secret, rawBody);

  if (!timingSafeEqualHex(providedSig.trim().toLowerCase(), expectedSig)) {
    return await logAndReturn(
      'hmac_mismatch',
      401,
      {
        ok: false,
        error: 'hmac_mismatch',
        hint: 'Assinatura HMAC inválida. Verifique se PROMOGIFTS_WEBHOOK_SECRET (aqui) = PROMO_CHAMPIONS_WEBHOOK_SECRET (PromoGifts) e se o body não foi modificado por proxy.',
        request_id: requestId,
      },
      { payloadSize: rawBody.length },
    );
  }

  // 2) Parse + validação Zod
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return await logAndReturn(
      'invalid_payload',
      400,
      { ok: false, error: 'invalid_json', request_id: requestId },
      { payloadSize: rawBody.length },
    );
  }

  const parsed = PayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return await logAndReturn(
      'invalid_payload',
      400,
      {
        ok: false,
        error: 'invalid_payload',
        details: parsed.error.flatten().fieldErrors,
        request_id: requestId,
      },
      { payloadSize: rawBody.length },
    );
  }

  const { event, correlation_key, payload } = parsed.data;

  // 3) Dedupe por correlation_key
  const { error: dedupeErr } = await supabase
    .from('webhook_inbound_dedupe')
    .insert({ correlation_key, event, source: 'promogifts' });

  if (dedupeErr) {
    // 23505 = unique violation → já processado
    if ((dedupeErr as { code?: string }).code === '23505') {
      await supabase.rpc('noop').catch(() => {}); // no-op
      // bump hit_count via update (best-effort)
      await supabase
        .from('webhook_inbound_dedupe')
        .update({ hit_count: (undefined as unknown) as number })
        .eq('correlation_key', correlation_key);
      // usa uma call SQL segura pra incrementar
      await supabase
        .rpc('increment_webhook_dedupe_hit', { _correlation_key: correlation_key })
        .catch(() => {});

      return await logAndReturn(
        'duplicate_ignored',
        200,
        {
          ok: true,
          status: 'duplicate_ignored',
          correlation_key,
          request_id: requestId,
        },
        { correlation_key, event, payloadSize: rawBody.length },
      );
    }
    return await logAndReturn(
      'internal_error',
      500,
      { ok: false, error: 'dedupe_failed', request_id: requestId },
      { correlation_key, event, payloadSize: rawBody.length, error: dedupeErr.message },
    );
  }

  // 4) Upsert idempotente por quote_id
  const { error: upsertErr } = await supabase
    .from('quotes_inbound')
    .upsert(
      {
        quote_id: payload.quote_id,
        quote_number: payload.quote_number ?? null,
        status: payload.status ?? null,
        client_id: payload.client_id ?? null,
        client_name: payload.client_name ?? null,
        total: payload.total ?? null,
        seller_email: payload.seller_email ?? null,
        source_updated_at: payload.updated_at ?? null,
        raw_payload: parsedJson as Record<string, unknown>,
      },
      { onConflict: 'quote_id' },
    );

  if (upsertErr) {
    return await logAndReturn(
      'internal_error',
      500,
      { ok: false, error: 'upsert_failed', request_id: requestId },
      { correlation_key, event, payloadSize: rawBody.length, error: upsertErr.message },
    );
  }

  return await logAndReturn(
    'ok',
    200,
    {
      ok: true,
      status: 'processed',
      quote_id: payload.quote_id,
      correlation_key,
      request_id: requestId,
    },
    { correlation_key, event, payloadSize: rawBody.length },
  );
});
