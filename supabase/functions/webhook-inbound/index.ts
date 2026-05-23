// webhook-inbound: receives external webhooks at /webhook-inbound?slug=<slug>
// Validates HMAC signature using the secret stored in env (referenced by the
// endpoint row), records every event in inbound_webhook_events.
//
// Hardening OPS-002 (auditoria back-end sênior 2026-05-22):
//   • bot-protection por IP no boot do handler (60 req/min, 30min block)
//     — evita DoS por inflação de inbound_webhook_events.
//   • INSERT no inbound_webhook_events só acontece após HMAC validar
//     OU se houver endpoint configurado mas signature inválida (registro
//     forense limitado a callers que conhecem ao menos o slug).
//
// Contract validation:
//   - v1 = passthrough (compat com produção). default.
//   - v2 = envelope strict { event, occurred_at, data, idempotency_key? }
//   Cliente seleciona via header `accept-version: 2` ou `?v=2`.
//   v1 será descontinuada em 2026-09-30; resposta inclui headers Deprecation/Sunset.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import { WebhookInboundSchemas } from "../_shared/contracts/schemas/webhook-inbound.ts";
import { runBotProtection } from "../_shared/bot-protection.ts";

const corsHeaders = buildPublicCorsHeaders({
  extraAllowHeaders: ["x-signature-256", "x-event", "accept-version"],
  allowMethods: "POST, OPTIONS",
});

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // OPS-002: rate-limit anti-DoS por IP antes de qualquer trabalho de DB.
  // Webhooks legítimos têm baixa cadência (≪60/min por IP); caller espurioso
  // que ultrapassa é blocked por 30min e nunca chega no INSERT.
  const protection = await runBotProtection(
    req,
    {
      endpoint: "webhook-inbound",
      maxRequests: 60,
      windowSeconds: 60,
      blockSeconds: 1800,
      allowSearchBots: false,
    },
    corsHeaders,
  );
  if (!protection.allowed) return protection.blockResponse!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")
      || url.pathname.split("/").filter(Boolean).pop()
      || "";
    if (!slug) {
      return new Response(
        JSON.stringify({ code: "missing_slug", message: "slug ausente", fields: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: endpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!endpoint) {
      return new Response(
        JSON.stringify({ code: "endpoint_not_found", message: "endpoint não encontrado", fields: [] }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // CRÍTICO: ler raw body UMA vez (HMAC precisa do raw exato; parseContract
    // recebe via prereadBody pra não tentar consumir o stream novamente).
    const rawBody = await req.text();

    // Validação de contrato (v1 = passthrough, v2 = envelope strict).
    // Em v1, schema é `z.any()` → passa sempre que houver body. Já cobre missing/invalid_json.
    const contractResult = await parseContract(req, WebhookInboundSchemas, {
      corsHeaders,
      prereadBody: rawBody,
    });
    if (!contractResult.ok) return contractResult.response;
    const { version, data: payloadParsed, responseHeaders } = contractResult;

    const signatureHeader = req.headers.get("x-signature-256")
      || req.headers.get("x-webhook-signature")
      || "";
    const eventType = req.headers.get("x-event")
      || (typeof payloadParsed === "object" && payloadParsed !== null && "event" in payloadParsed
        ? String((payloadParsed as { event: unknown }).event)
        : "unknown");
    const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const secretRes = await supabase
      .from("integration_credentials")
      .select("secret_value")
      .eq("secret_name", endpoint.hmac_secret_ref)
      .maybeSingle();
    const secret = secretRes.data?.secret_value || Deno.env.get(endpoint.hmac_secret_ref);

    let signatureValid = false;
    if (secret) {
      const expected = "sha256=" + await hmacSign(rawBody, secret);
      const provided = signatureHeader.startsWith("sha256=")
        ? signatureHeader
        : "sha256=" + signatureHeader;
      signatureValid = timingSafeEqual(expected, provided);
    }

    await supabase.from("inbound_webhook_events").insert({
      endpoint_id: endpoint.id,
      event_type: eventType,
      payload: payloadParsed,
      signature_valid: signatureValid,
      processed: signatureValid,
      source_ip: sourceIp,
      error: signatureValid ? null : "HMAC inválido ou ausente",
      contract_version: version,
    });

    await supabase
      .from("inbound_webhook_endpoints")
      .update({
        last_received_at: new Date().toISOString(),
        total_received: (endpoint.total_received ?? 0) + 1,
        total_invalid: (endpoint.total_invalid ?? 0) + (signatureValid ? 0 : 1),
      })
      .eq("id", endpoint.id);

    const okHeaders = { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" };

    if (!signatureValid) {
      return new Response(
        JSON.stringify({ code: "invalid_signature", message: "Assinatura inválida", fields: [] }),
        { status: 401, headers: okHeaders },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, received: true }),
      { headers: okHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return new Response(
      JSON.stringify({ code: "internal_error", message: msg, fields: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
