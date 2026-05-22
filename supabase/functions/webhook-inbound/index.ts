// webhook-inbound: receives external webhooks at /webhook-inbound?slug=<slug>
// Validates HMAC signature using the secret stored in env (referenced by the
// endpoint row), records every event in inbound_webhook_events.
//
// VALIDAÇÃO DE CONTRATO (feat/contract-tests-zod-v1-v2):
//   - v1 (default): valida envelope mínimo { event|type, data, ... } com Zod
//   - Modo PERMISSIVO (default): se schema falhar, grava no DB com
//     `error: "Validation: ..."` e `processed: false`. Retorna 200 OK para
//     não quebrar integradores legados (n8n, Bitrix, GitHub).
//   - Modo STRICT (?strict=1): retorna 422 padronizado em falha de schema.
//
// HMAC continua sendo a primeira linha de defesa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import {
  WebhookInboundSchemaByVersion,
  WebhookInboundVersions,
  type WebhookInboundVersion,
} from "../_shared/contracts/index.ts";
import {
  parseApiVersion,
  withVersionHeaders,
} from "../_shared/contract-versioning.ts";
import { validationError422 } from "../_shared/api-errors.ts";

const corsHeaders = buildPublicCorsHeaders({
  extraAllowHeaders: ["x-signature-256", "x-event", "x-api-version"],
  allowMethods: "POST, OPTIONS",
});

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
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

  // Versão da API
  const versioned = parseApiVersion<WebhookInboundVersion>(req, WebhookInboundVersions, {
    defaultVersion: "v1",
    corsHeaders,
  });
  if ("error" in versioned) return versioned.error;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")
      || url.pathname.split("/").filter(Boolean).pop()
      || "";
    const strictMode = url.searchParams.get("strict") === "1";

    if (!slug) {
      return withVersionHeaders(
        new Response(JSON.stringify({ error: "slug ausente" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
        versioned,
      );
    }

    const { data: endpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!endpoint) {
      return withVersionHeaders(
        new Response(JSON.stringify({ error: "endpoint não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
        versioned,
      );
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-signature-256")
      || req.headers.get("x-webhook-signature")
      || "";
    const eventType = req.headers.get("x-event") || "unknown";
    const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const secretRes = await supabase.from('integration_credentials').select('secret_value').eq('secret_name', endpoint.hmac_secret_ref).maybeSingle();
    const secret = secretRes.data?.secret_value || Deno.env.get(endpoint.hmac_secret_ref);

    let signatureValid = false;
    if (secret) {
      const expected = "sha256=" + await hmacSign(rawBody, secret);
      const provided = signatureHeader.startsWith("sha256=") ? signatureHeader : "sha256=" + signatureHeader;
      signatureValid = timingSafeEqual(expected, provided);
    }

    let parsedPayload: unknown = null;
    try { parsedPayload = JSON.parse(rawBody); } catch { /* keep null */ }

    // Validar contra o schema do contrato (apenas se HMAC válido — não gasta CPU em payload de atacante).
    let validationError: string | null = null;
    if (signatureValid && parsedPayload !== null) {
      const schema = WebhookInboundSchemaByVersion[versioned.version];
      const parsed = schema.safeParse(parsedPayload);
      if (!parsed.success) {
        // STRICT: rejeita com 422.
        if (strictMode) {
          await supabase.from("inbound_webhook_events").insert({
            endpoint_id: endpoint.id,
            event_type: eventType,
            payload: parsedPayload,
            signature_valid: true,
            processed: false,
            source_ip: sourceIp,
            error: "Validation rejected (strict mode)",
          });
          return withVersionHeaders(
            validationError422(parsed.error, { corsHeaders, apiVersion: versioned.version }),
            versioned,
          );
        }
        // PERMISSIVO (default): registra mas continua.
        validationError = parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")
          .slice(0, 1000);
      }
    }

    await supabase.from("inbound_webhook_events").insert({
      endpoint_id: endpoint.id,
      event_type: eventType,
      payload: parsedPayload,
      signature_valid: signatureValid,
      // Considera "processed" só se HMAC válido E (sem erro de validação OU schema OK)
      processed: signatureValid && validationError === null,
      source_ip: sourceIp,
      error: !signatureValid
        ? "HMAC inválido ou ausente"
        : validationError
        ? `Validation: ${validationError}`
        : null,
    });

    await supabase.from("inbound_webhook_endpoints").update({
      last_received_at: new Date().toISOString(),
      total_received: (endpoint.total_received ?? 0) + 1,
      total_invalid: (endpoint.total_invalid ?? 0) + (signatureValid ? 0 : 1),
    }).eq("id", endpoint.id);

    if (!signatureValid) {
      return withVersionHeaders(
        new Response(JSON.stringify({ error: "Assinatura inválida" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
        versioned,
      );
    }

    return withVersionHeaders(
      new Response(
        JSON.stringify({
          ok: true,
          received: true,
          validation_warning: validationError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
      versioned,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return withVersionHeaders(
      new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
      versioned,
    );
  }
});
