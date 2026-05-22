// webhook-inbound: receives external webhooks at /webhook-inbound?slug=<slug>
// Validates HMAC signature using the secret stored in env (referenced by the
// endpoint row), records every event in inbound_webhook_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = buildPublicCorsHeaders({ extraAllowHeaders: ["x-signature-256","x-event"], allowMethods: "POST, OPTIONS" });

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
      return new Response(JSON.stringify({ error: "slug ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: endpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!endpoint) {
      return new Response(JSON.stringify({ error: "endpoint não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    await supabase.from("inbound_webhook_events").insert({
      endpoint_id: endpoint.id,
      event_type: eventType,
      payload: parsedPayload,
      signature_valid: signatureValid,
      processed: signatureValid,
      source_ip: sourceIp,
      error: signatureValid ? null : "HMAC inválido ou ausente",
    });

    await supabase.from("inbound_webhook_endpoints").update({
      last_received_at: new Date().toISOString(),
      total_received: (endpoint.total_received ?? 0) + 1,
      total_invalid: (endpoint.total_invalid ?? 0) + (signatureValid ? 0 : 1),
    }).eq("id", endpoint.id);

    if (!signatureValid) {
      return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Post-HMAC schema validation per slug. Admin can register a JSON-schema-
    // shaped `contract_schema` per `inbound_webhook_endpoints` row to enforce
    // payload shape (subset of Zod: { fields: [{ name, type, required }] }).
    // When `contract_schema` is null, payload acceptance stays as before
    // (accept any JSON object). When present, missing required fields or
    // type mismatches return 422 in the unified envelope.
    const contractSchema = (endpoint as { contract_schema?: { fields?: Array<{ name: string; type: string; required?: boolean }> } | null }).contract_schema;
    const contractVersion = (endpoint as { contract_version?: string }).contract_version ?? "v1";
    if (contractSchema?.fields && parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)) {
      const obj = parsedPayload as Record<string, unknown>;
      const issues: Array<{ path: string; code: string; message: string }> = [];
      for (const f of contractSchema.fields) {
        const v = obj[f.name];
        if (v === undefined || v === null) {
          if (f.required) issues.push({ path: f.name, code: "missing", message: `${f.name} is required` });
          continue;
        }
        const actualType = Array.isArray(v) ? "array" : typeof v;
        const expected = f.type;
        if (expected && expected !== actualType && expected !== "any") {
          issues.push({ path: f.name, code: "invalid_type", message: `${f.name} must be ${expected}, got ${actualType}` });
        }
      }
      if (issues.length > 0) {
        return new Response(
          JSON.stringify({
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            error: "Validation failed",
            fields: issues,
          }),
          {
            status: 422,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Error-Code": "VALIDATION_FAILED",
              "X-Contract-Version": contractVersion,
            },
          },
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, received: true, contract_version: contractVersion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Contract-Version": contractVersion },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
