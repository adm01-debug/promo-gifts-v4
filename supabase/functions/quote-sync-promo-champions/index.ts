// quote-sync-promo-champions: proxy fino chamado pelo frontend.
// - Valida JWT do vendedor
// - Assina o payload com PROMO_CHAMPIONS_WEBHOOK_SECRET (HMAC-SHA256)
// - POSTa direto em receive-quote-sync do Promo Champions
//   (ref do projeto Champions: rapjswienfhkobhlamxb)
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";

const cors = buildPublicCorsHeaders({ allowMethods: "POST, OPTIONS" });
const baseLog = createStructuredLogger("quote-sync-promo-champions");

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

  // Ownership check: buscar o quote com service_role e validar seller_id.
  // JWT já foi validado acima (claims.claims.sub = auth.uid do vendedor).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return json(
      { error: "service_misconfigured", hint: "SUPABASE_SERVICE_ROLE_KEY ausente." },
      503,
    );
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const sellerId = claims.claims.sub;

  const { data: quote, error: quoteErr } = await supabaseAdmin
    .from("quotes")
    .select(
      "id, quote_number, status, seller_id, client_id, client_name, client_email, total, updated_at, sent_at",
    )
    .eq("id", q.quote_id)
    .maybeSingle();

  if (quoteErr) {
    console.error("quote_fetch_failed", { quote_id: q.quote_id, error: quoteErr.message });
    return json({ error: "quote_fetch_failed", details: quoteErr.message }, 500);
  }
  if (!quote) {
    return json({ error: "quote_not_found", hint: "Orçamento não existe" }, 404);
  }
  if (quote.seller_id !== sellerId) {
    return json({ error: "forbidden", hint: "Este orçamento não pertence a você" }, 403);
  }

  // ─── Rate limiting: 10 syncs/h por (seller × quote) ─────────────────────
  const rlIdentifier = `${sellerId}:${q.quote_id}`;
  const rlEndpoint = "quote-sync-promo-champions";
  const rlWindowMs = 60 * 60 * 1000;
  const rlMaxCalls = 10;

  const { data: rlRow } = await supabaseAdmin
    .from("request_rate_limits")
    .select("id, request_count, window_start, blocked_until")
    .eq("identifier", rlIdentifier)
    .eq("endpoint", rlEndpoint)
    .maybeSingle();

  const nowMs = Date.now();

  if (rlRow?.blocked_until && new Date(rlRow.blocked_until).getTime() > nowMs) {
    return json({
      error: "rate_limit_exceeded",
      hint: "Máximo de 10 sincronizações por orçamento por hora.",
      retry_after: rlRow.blocked_until,
    }, 429);
  }

  const windowExpired = !rlRow ||
    (nowMs - new Date(rlRow.window_start).getTime()) > rlWindowMs;

  if (windowExpired) {
    await supabaseAdmin.from("request_rate_limits").upsert({
      identifier: rlIdentifier,
      endpoint: rlEndpoint,
      request_count: 1,
      window_start: new Date().toISOString(),
      blocked_until: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "identifier,endpoint" });
  } else {
    const newCount = (rlRow?.request_count ?? 0) + 1;
    // Semântica: "10 req/h" ⇒ calls 1..10 passam, a 11ª (newCount=11) bloqueia.
    const exceeded = newCount > rlMaxCalls;
    const blockedUntil = exceeded
      ? new Date(new Date(rlRow!.window_start).getTime() + rlWindowMs).toISOString()
      : null;
    await supabaseAdmin.from("request_rate_limits").update({
      request_count: newCount,
      blocked_until: blockedUntil,
      updated_at: new Date().toISOString(),
    }).eq("identifier", rlIdentifier).eq("endpoint", rlEndpoint);

    if (exceeded) {
      return json({
        error: "rate_limit_exceeded",
        hint: "Máximo de 10 sincronizações por orçamento por hora.",
        retry_after: blockedUntil,
      }, 429);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────



  // Atualiza status para 'sent' (uma vez) — não bloqueia o sync se falhar.
  if (quote.status !== "sent") {
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("quotes")
      .update({ status: "sent", sent_at: nowIso, last_sent_at: nowIso })
      .eq("id", q.quote_id)
      .eq("seller_id", sellerId);
    if (updateErr) {
      console.error("status_update_failed", {
        quote_id: q.quote_id,
        error: updateErr.message,
      });
    }
  } else {
    // Re-envio: apenas atualiza last_sent_at.
    const { error: reErr } = await supabaseAdmin
      .from("quotes")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", q.quote_id)
      .eq("seller_id", sellerId);
    if (reErr) {
      console.error("last_sent_at_update_failed", {
        quote_id: q.quote_id,
        error: reErr.message,
      });
    }
  }

  // correlation_key determinístico. Se o DB tem updated_at (sempre tem), usa ele;
  // fallback derradeiro é o próprio quote_id (nunca timestamp gerado).
  //
  // ⚠️ IMPORTANTE: `updated_at` vem do Postgres como `timestamptz` e pode ser
  // serializado em variantes equivalentes ("Z", "+00:00", com/sem microsegundos).
  // Cada variante geraria uma correlation_key distinta → dedup bypass no destino.
  // Por isso normalizamos para o ISO canônico (`toISOString()` → sempre "Z" + ms).
  const updatedAtSource = normalizeTs(quote.updated_at ?? q.updated_at);
  const correlationKey = `quote:${q.quote_id}:sent:${updatedAtSource ?? q.quote_id}`;

  // Fonte da verdade: dados do DB (não do frontend), com fallback nos campos vindos do body.
  const bodyObj = {
    event: "quote.sent",
    correlation_key: correlationKey,
    payload: {
      quote_id: quote.id,
      quote_number: q.quote_number ?? quote.quote_number,
      status: "sent",
      client_id: q.client_id ?? (quote.client_id ? String(quote.client_id) : null),
      client_name: q.client_name ?? quote.client_name,
      total:
        q.total ??
        (quote.total !== null && quote.total !== undefined ? Number(quote.total) : null),
      // Normalizado para casar com a correlation_key (mesma representação canônica).
      updated_at: normalizeTs(quote.updated_at ?? q.updated_at),
      seller_email: q.seller_email ?? null,
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

export { hmacSha256Hex, normalizeTs };

/**
 * Normaliza um timestamp arbitrário (ISO com/sem "Z", com/sem microssegundos,
 * offset ±HH:MM etc.) para o ISO canônico UTC produzido por `Date#toISOString()`:
 *   "YYYY-MM-DDTHH:mm:ss.sssZ"
 *
 * Usado na `correlation_key` para garantir que a MESMA quote/updated_at gere
 * SEMPRE a mesma chave, independentemente de como o Postgres/driver formatar.
 *
 * Fallback: se `ts` for null/undefined → null; se for inparseável → devolve
 * a string original (não bloqueia o fluxo; apenas perde o efeito de dedup).
 */
function normalizeTs(ts: string | null | undefined): string | null {
  if (ts === null || ts === undefined || ts === "") return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString();
}

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
