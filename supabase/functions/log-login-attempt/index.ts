import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { RateLimiter, applyRateLimit } from "../_shared/rate-limiter.ts";
import { z } from "npm:zod@3.23.8";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const LoginAttemptSchema = z.object({
  email: z.string().email().max(255),
  user_id: z.string().uuid().nullish(),
  ip_address: z.string().max(45).default("unknown"),
  success: z.boolean(),
  failure_reason: z.string().max(500).nullish(),
  user_agent: z.string().max(512).nullish(),
});

// Rate limiter: 10 login log attempts per minute per IP
const loginLogLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: 'login-log',
});

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "log-login-attempt", requestId, req });

  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  // DIAGNOSTIC: Check project ID consistency in Edge Runtime
  const envUrl = Deno.env.get("SUPABASE_URL") || "";
  const CANONICAL_ID = "doufsxqlfjyuvxuezpln";
  if (!envUrl.includes(CANONICAL_ID)) {
    console.error(`[CRITICAL] Edge Function Project Mismatch: Environment URL is ${envUrl}, expected ID ${CANONICAL_ID}`);
    log.error("project_mismatch", { current_url: envUrl, expected_id: CANONICAL_ID });
  }

  try {
    // Rate limit by IP
    const rateLimitResponse = await applyRateLimit(req, loginLogLimiter);
    if (rateLimitResponse) {
      log.warn("rate_limit_exceeded");
      const headers = new Headers(rateLimitResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(rateLimitResponse.body, {
        status: rateLimitResponse.status,
        headers,
      });
    }

    let body: unknown;
    try {
      const text = await req.text();
      if (!text.trim()) {
        return new Response(
          JSON.stringify({ error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const parsed = LoginAttemptSchema.safeParse(body);
    if (!parsed.success) {
      log.warn("invalid_payload", { errors: parsed.error.flatten().fieldErrors });
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { email, user_id, ip_address, success, failure_reason, user_agent } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      log.error("missing_env_vars", { url: !!supabaseUrl, key: !!serviceRoleKey });
      return new Response(
        JSON.stringify({ error: "Internal configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service_role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabaseAdmin.from("login_attempts").insert({
      email,
      user_id: user_id || null,
      ip_address: ip_address || "unknown",
      success,
      failure_reason: failure_reason || null,
      user_agent: user_agent || null,
    });

    if (error) {
      log.error("db_insert_failed", { error: error.message, code: error.code });
      return new Response(
        JSON.stringify({ error: "Failed to log attempt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log.info("login_attempt_logged", { email, success });
    return log.respond(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    ));
  } catch (err) {
    log.error("internal_error", { err });
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
