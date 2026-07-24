// supabase/functions/magazine-public-react/index.ts
//
// verify_jwt = false (público) — ver supabase/config.toml.
// FIX 2026-07-12: config.toml não tinha entrada, caiu em verify_jwt=true
// default e bloqueava 100% do tráfego anônimo no gateway. Corrigido.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { handleCorsPreflight, buildPublicCorsHeaders } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { RateLimiter } from "../_shared/rate-limiter.ts";

const bodySchema = z.object({
  token: z.string().min(24).max(64).regex(/^[a-f0-9]+$/i),
  fingerprint: z.string().min(8).max(128),
  kind: z.enum(["like", "love", "fire", "idea"]),
  pageIndex: z.number().int().min(0).max(9999).nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
});

const reactLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000, keyPrefix: "mag-react" });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("MAGAZINE_IP_SALT") ?? "promo-gifts-v4-fallback-salt-2026";
  const truncated = ip.includes(".") ? ip.split(".").slice(0, 3).join(".") + ".0" : ip;
  return sha256Hex(truncated + salt);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "magazine-public-react", requestId, req });
  const jsonHeaders = { ...buildPublicCorsHeaders(), "Content-Type": "application/json" };

  try {
    if (req.method !== "POST") {
      return log.respond(new Response(JSON.stringify({ error: "method_not_allowed", request_id: requestId }), { status: 405, headers: jsonHeaders }));
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return log.respond(new Response(
        JSON.stringify({ error: "invalid_request", request_id: requestId, details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      ));
    }
    const { token, fingerprint, kind, pageIndex, itemId } = parsed.data;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
    const rl = await reactLimiter.check(`${ip}:${fingerprint}`);
    if (!rl.allowed) {
      return log.respond(new Response(JSON.stringify({ error: "rate_limited", request_id: requestId }), { status: 429, headers: jsonHeaders }));
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: mag, error: magErr } = await supabase
      .from("magazines").select("id").eq("public_token", token).eq("status", "published").maybeSingle();
    if (magErr || !mag) {
      return log.respond(new Response(JSON.stringify({ error: "invalid_or_expired", request_id: requestId }), { status: 401, headers: jsonHeaders }));
    }

    const ipHash = await hashIp(ip);

    // FIX (auditoria 2026-07-12): .match() com valores null pode gerar
    // 'column=eq.null' em vez de 'column=is.null' dependendo da versao do
    // supabase-js, o que NUNCA daria match em uma linha com valor NULL de
    // fato (PostgREST exige eq.null especificamente, mas o comportamento
    // variou entre versoes). Construimos o filtro explicitamente com
    // .is()/.eq() para garantir semantica correta e determinística.
    let existingQuery = supabase
      .from("magazine_public_reactions")
      .select("id")
      .eq("magazine_id", mag.id)
      .eq("viewer_fingerprint", fingerprint)
      .eq("kind", kind);
    existingQuery = pageIndex === null || pageIndex === undefined
      ? existingQuery.is("page_index", null)
      : existingQuery.eq("page_index", pageIndex);
    existingQuery = itemId === null || itemId === undefined
      ? existingQuery.is("item_id", null)
      : existingQuery.eq("item_id", itemId);

    const { data: existing, error: selectErr } = await existingQuery.maybeSingle();
    if (selectErr) {
      log.error("select_failed", { error: selectErr.message });
      return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
    }

    if (existing) {
      const { error: delErr } = await supabase.from("magazine_public_reactions").delete().eq("id", existing.id);
      if (delErr) {
        log.error("delete_failed", { error: delErr.message });
        return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
      }
      log.info("toggled_removed");
      return log.respond(new Response(JSON.stringify({ toggled: "removed", request_id: requestId }), { status: 200, headers: jsonHeaders }));
    }

    const { error: insErr } = await supabase.from("magazine_public_reactions").insert({
      magazine_id: mag.id,
      viewer_fingerprint: fingerprint,
      kind,
      page_index: pageIndex ?? null,
      item_id: itemId ?? null,
      ip_hash: ipHash,
    });
    if (insErr) {
      log.error("insert_failed", { error: insErr.message });
      return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
    }

    log.info("toggled_added");
    return log.respond(new Response(JSON.stringify({ toggled: "added", request_id: requestId }), { status: 200, headers: jsonHeaders }));
  } catch (err) {
    log.error("unhandled_exception", { err });
    return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
  }
});
