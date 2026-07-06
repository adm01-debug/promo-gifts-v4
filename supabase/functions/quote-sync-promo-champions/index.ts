// quote-sync-promo-champions: proxy fino chamado pelo frontend.
// - Valida JWT do vendedor
// - Assina o payload com PROMO_CHAMPIONS_WEBHOOK_SECRET (HMAC-SHA256)
// - POSTa direto em receive-quote-sync do Promo Champions
//   (ref do projeto Champions: rapjswienfhkobhlamxb)
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";

const cors = buildPublicCorsHeaders({ allowMethods: "POST, OPTIONS" });

const CHAMPIONS_URL =
  "https://rapjswienfhkobhlamxb.supabase.co/functions/v1/receive-quote-sync";

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

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  const secret = Deno.env.get("PROMO_CHAMPIONS_WEBHOOK_SECRET");
  if (!secret) {
    return json(
      {
        error: "service_misconfigured",
        hint: "PROMO_CHAMPIONS_WEBHOOK_SECRET ausente — configure no cofre do projeto.",
      },
      503,
    );
  }

  const correlationKey = `quote:${q.quote_id}:sent:${q.updated_at ?? new Date().toISOString()}`;

  const bodyObj = {
    event: "quote.sent",
    correlation_key: correlationKey,
    payload: {
      quote_id: q.quote_id,
      quote_number: q.quote_number,
      status: q.status,
      client_id: q.client_id,
      client_name: q.client_name,
      total: q.total,
      updated_at: q.updated_at,
      seller_email: q.seller_email,
    },
  };
  const bodyStr = JSON.stringify(bodyObj);

  let signatureHex: string;
  try {
    signatureHex = await hmacSha256Hex(secret, bodyStr);
  } catch (err) {
    console.error("hmac_failed", { message: (err as Error).message });
    return json({ error: "signature_failed" }, 500);
  }

  const startedAt = Date.now();
  let resp: Response;
  try {
    resp = await fetch(CHAMPIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-event": "quote.sent",
        "x-webhook-signature": `sha256=${signatureHex}`,
        "x-correlation-key": correlationKey,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    console.error("champions_fetch_failed", {
      message: (err as Error).message,
      quote_id: q.quote_id,
      correlation_key: correlationKey,
      duration_ms,
    });
    return json(
      { ok: false, error: "champions_unreachable", details: (err as Error).message },
      502,
    );
  }

  const duration_ms = Date.now() - startedAt;
  const text = await resp.text();

  if (!resp.ok) {
    console.error("champions_non_2xx", {
      status: resp.status,
      quote_id: q.quote_id,
      correlation_key: correlationKey,
      duration_ms,
      details: text.slice(0, 500),
    });
    return json(
      {
        ok: false,
        error: "champions_failed",
        champions_status: resp.status,
        correlation_key: correlationKey,
        details: text.slice(0, 2000),
      },
      resp.status,
    );
  }

  console.log("champions_ok", {
    status: resp.status,
    quote_id: q.quote_id,
    correlation_key: correlationKey,
    duration_ms,
  });

  return json(
    {
      ok: true,
      correlation_key: correlationKey,
      champions_status: resp.status,
      champions_response: safeJson(text),
    },
    200,
  );
};

Deno.serve(handler);

export { hmacSha256Hex };

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
