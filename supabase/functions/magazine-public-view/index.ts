// supabase/functions/magazine-public-view/index.ts
//
// B.1 — Leitura pública de revista via public_token.
// FIX C1 (auditoria): o client NUNCA lê magazine_reader_state/magazines
// direto — RLS bloqueia anon em 100% das tabelas magazine_*. Esta edge
// usa service_role internamente e é o ÚNICO caminho de leitura pública.
//
// verify_jwt = false (público, sem autenticação) — ver supabase/config.toml.
// FIX 2026-07-12 (validação exaustiva): config.toml não tinha entrada para
// esta função e caiu no default verify_jwt=true, bloqueando 100% do tráfego
// anônimo no gateway ANTES deste código rodar. Corrigido.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { handleCorsPreflight, buildPublicCorsHeaders } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { RateLimiter } from "../_shared/rate-limiter.ts";

const bodySchema = z.object({
  token: z.string().min(24).max(64).regex(/^[a-f0-9]+$/i, "token deve ser hexadecimal"),
});

// FIX A9: 20 req/min por IP conforme spec B.1.2 — fail-open (não é endpoint sensível de auth)
const viewLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000, keyPrefix: "mag-public-view" });

function sha256Hex(input: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then((buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

// FIX R3: hash de IP feito na EDGE (Deno), nunca no Postgres — banco nunca vê IP cru nem salt
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("MAGAZINE_IP_SALT") ?? "promo-gifts-v4-fallback-salt-2026";
  // Trunca IPv4 para /24 antes de hashear — reduz espaço de busca de brute-force (FIX M8)
  const truncated = ip.includes(".") ? ip.split(".").slice(0, 3).join(".") + ".0" : ip;
  return sha256Hex(truncated + salt);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "magazine-public-view", requestId, req });
  const corsHeaders = buildPublicCorsHeaders();
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return log.respond(new Response(JSON.stringify({ error: "method_not_allowed", request_id: requestId }), { status: 405, headers: jsonHeaders }));
    }

    let rawToken: string | null = null;
    if (req.method === "GET") {
      rawToken = new URL(req.url).searchParams.get("token");
    } else {
      const body = await req.json().catch(() => null);
      rawToken = body?.token ?? null;
    }

    const parsed = bodySchema.safeParse({ token: rawToken });
    if (!parsed.success) {
      log.warn("validation_failed", { errors: parsed.error.flatten() });
      return log.respond(new Response(
        JSON.stringify({ error: "invalid_request", request_id: requestId, details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      ));
    }
    const token = parsed.data.token;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "0.0.0.0";
    const rl = await viewLimiter.check(ip);
    if (!rl.allowed) {
      log.warn("rate_limited", { ip_prefix: ip.split(".").slice(0, 2).join(".") });
      return log.respond(new Response(JSON.stringify({ error: "rate_limited", request_id: requestId }), { status: 429, headers: jsonHeaders }));
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await sha256Hex(token);
    const ipHash = await hashIp(ip);

    const { data: magazine, error } = await supabase
      .from("magazines")
      .select(`
        id, title, subtitle, template_id, branding, content_settings, page_order, status,
        magazine_items ( id, product_id, variant_color_name, position, page_number, product_snapshot, overrides )
      `)
      .eq("public_token", token)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      log.error("db_error", { error: error.message });
      return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
    }

    if (!magazine) {
      await supabase.rpc("record_public_token_failure", {
        _resource_type: "magazine",
        _resource_id: tokenHash,
        _attempted_token: tokenHash,
        _ip: ip,
        _ua: req.headers.get("user-agent") ?? "",
        _reason: "not_found_or_unpublished",
      }).then(() => {}, (e: unknown) => log.warn("record_failure_error", { err: String(e) }));

      log.warn("token_not_found");
      return log.respond(new Response(JSON.stringify({ error: "invalid_or_expired", request_id: requestId }), { status: 401, headers: jsonHeaders }));
    }

    await supabase.from("magazine_public_view_events").insert({
      magazine_id: magazine.id,
      token_hash: tokenHash,
      ip_hash: ipHash,
      user_agent_hash: await sha256Hex((req.headers.get("user-agent") ?? "").slice(0, 200)),
      referer_host: (() => { try { return req.headers.get("referer") ? new URL(req.headers.get("referer")!).host : null; } catch { return null; } })(),
    }).then(() => {}, (e: unknown) => log.warn("view_event_insert_failed", { err: String(e) }));

    const payload = {
      id: magazine.id,
      title: magazine.title,
      subtitle: magazine.subtitle,
      templateId: magazine.template_id,
      branding: magazine.branding,
      content: magazine.content_settings,
      pageOrder: magazine.page_order,
      status: magazine.status,
      items: (magazine.magazine_items ?? [])
        .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
        .map((it: Record<string, unknown>) => ({
          id: it.id,
          productId: it.product_id,
          productSnapshot: it.product_snapshot,
          variantColorName: it.variant_color_name,
          position: it.position,
          pageNumber: it.page_number,
          overrides: it.overrides,
        })),
    };

    log.info("view_ok", { magazine_id: magazine.id, item_count: payload.items.length });
    return log.respond(new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders }));
  } catch (err) {
    log.error("unhandled_exception", { err });
    return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
  }
});
