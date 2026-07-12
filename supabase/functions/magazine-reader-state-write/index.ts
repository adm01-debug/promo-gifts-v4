// supabase/functions/magazine-reader-state-write/index.ts
//
// B.2 — Upsert de bookmarks/última-página do leitor público.
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
  lastPageIndex: z.number().int().min(0).max(9999).optional(),
  bookmarks: z.array(z.number().int().min(0)).max(500).optional(),
  sessionId: z.string().max(128).optional(),
});

const writeLimiter = new RateLimiter({ maxRequests: 5, windowMs: 1_000, keyPrefix: "mag-reader-write" });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "magazine-reader-state-write", requestId, req });
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
    const { token, fingerprint, lastPageIndex, bookmarks, sessionId: _sessionId } = parsed.data;

    const rl = await writeLimiter.check(fingerprint);
    if (!rl.allowed) {
      return log.respond(new Response(JSON.stringify({ error: "rate_limited", request_id: requestId }), { status: 429, headers: jsonHeaders }));
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await sha256Hex(token);

    const { data: mag, error: magErr } = await supabase
      .from("magazines").select("id").eq("public_token", token).eq("status", "published").maybeSingle();

    if (magErr) {
      log.error("db_error_lookup", { error: magErr.message });
      return log.respond(new Response(JSON.stringify({ error: "sync_disabled", request_id: requestId }), { status: 503, headers: jsonHeaders }));
    }
    if (!mag) {
      return log.respond(new Response(JSON.stringify({ error: "invalid_or_expired", request_id: requestId }), { status: 401, headers: jsonHeaders }));
    }

    const { error: upsertError } = await supabase
      .from("magazine_reader_state")
      .upsert({
        magazine_token_hash: tokenHash,
        viewer_fingerprint: fingerprint,
        ...(lastPageIndex !== undefined ? { last_page_index: lastPageIndex } : {}),
        ...(bookmarks !== undefined ? { bookmarks } : {}),
      }, { onConflict: "magazine_token_hash,viewer_fingerprint" });

    if (upsertError) {
      const code = (upsertError as { code?: string }).code ?? "";
      log.error("upsert_failed", { code, error: upsertError.message });
      if (code === "42501" || code === "42P01") {
        return log.respond(new Response(JSON.stringify({ error: "sync_disabled", request_id: requestId }), { status: 503, headers: jsonHeaders }));
      }
      return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
    }

    log.info("write_ok");
    return log.respond(new Response(JSON.stringify({ ok: true, request_id: requestId }), { status: 200, headers: jsonHeaders }));
  } catch (err) {
    log.error("unhandled_exception", { err });
    return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
  }
});
