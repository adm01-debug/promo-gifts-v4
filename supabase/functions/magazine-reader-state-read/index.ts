// supabase/functions/magazine-reader-state-read/index.ts
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

const querySchema = z.object({
  token: z.string().min(24).max(64).regex(/^[a-f0-9]+$/i),
  fingerprint: z.string().min(8).max(128),
});

const readLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000, keyPrefix: "mag-reader-read" });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "magazine-reader-state-read", requestId, req });
  const jsonHeaders = { ...buildPublicCorsHeaders(), "Content-Type": "application/json" };

  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      token: url.searchParams.get("token"),
      fingerprint: url.searchParams.get("fingerprint"),
    });
    if (!parsed.success) {
      return log.respond(new Response(
        JSON.stringify({ error: "invalid_request", request_id: requestId, details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      ));
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
    const rl = await readLimiter.check(ip);
    if (!rl.allowed) {
      return log.respond(new Response(JSON.stringify({ error: "rate_limited", request_id: requestId }), { status: 429, headers: jsonHeaders }));
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await sha256Hex(parsed.data.token);

    const { data, error } = await supabase
      .from("magazine_reader_state")
      .select("bookmarks, last_page_index")
      .eq("magazine_token_hash", tokenHash)
      .eq("viewer_fingerprint", parsed.data.fingerprint)
      .maybeSingle();

    if (error) {
      log.warn("db_error", { error: error.message });
      return log.respond(new Response(JSON.stringify({ error: "sync_disabled", request_id: requestId }), { status: 503, headers: jsonHeaders }));
    }

    return log.respond(new Response(
      JSON.stringify({ bookmarks: data?.bookmarks ?? [], lastPageIndex: data?.last_page_index ?? 0, request_id: requestId }),
      { status: 200, headers: jsonHeaders },
    ));
  } catch (err) {
    log.error("unhandled_exception", { err });
    return log.respond(new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), { status: 500, headers: jsonHeaders }));
  }
});
