// quote-sync-promo-champions: proxy fino chamado pelo frontend.
// - Valida JWT do vendedor (Modo B seguro)
// - Injeta x-dispatcher-secret do env e invoca webhook-dispatcher (Modo A)
// - Payload padronizado + correlation_key p/ dedupe no destino
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";

const cors = buildPublicCorsHeaders({ allowMethods: "POST, OPTIONS" });

const Body = z.object({
  quote_id: z.string().uuid(),
  quote_number: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  client_name: z.string().optional().nullable(),
  total: z.number().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  seller_email: z.string().optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return json({ error: "Unauthorized" }, 401);
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }
  const q = parsed.data;

  const dispatcherSecret = Deno.env.get("WEBHOOK_DISPATCHER_SECRET");
  if (!dispatcherSecret) {
    return json({ error: "service_misconfigured", hint: "WEBHOOK_DISPATCHER_SECRET missing" }, 503);
  }

  const correlationKey = `quote:${q.quote_id}:sent:${q.updated_at ?? ""}`;

  const resp = await fetch(`${supabaseUrl}/functions/v1/webhook-dispatcher`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      "x-dispatcher-secret": dispatcherSecret,
    },
    body: JSON.stringify({
      event: "quote.sent",
      payload: {
        quote_id: q.quote_id,
        quote_number: q.quote_number,
        status: q.status,
        client_id: q.client_id,
        client_name: q.client_name,
        total: q.total,
        updated_at: q.updated_at,
        seller_email: q.seller_email,
        correlation_key: correlationKey,
        source: "manual_sync_promo_champions",
      },
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    return json(
      { ok: false, error: "dispatcher_failed", status: resp.status, details: text.slice(0, 2000) },
      resp.status,
    );
  }

  return json({ ok: true, correlation_key: correlationKey, dispatcher_response: safeJson(text) }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
