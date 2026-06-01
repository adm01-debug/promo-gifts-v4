// supabase/functions/e2e-cleanup/index.ts
// BUG-EF-006 FIXED: supabase-js@2.45.0 -> @2.49.4
/**
 * e2e-cleanup -- Apaga dados de aplicacao criados por usuarios de teste E2E.
 *
 * Camadas de seguranca:
 *  1. Header x-e2e-cleanup-token precisa bater com E2E_CLEANUP_TOKEN (timing-safe).
 *  2. Rate limit por IP via RPC e2e_cleanup_check_rate_limit.
 *  3. email do body precisa estar em E2E_CLEANUP_ALLOWED_EMAILS (CSV).
 *  4. user_id e resolvido server-side via auth.admin.
 *  5. dryRun = true por default.
 *  6. Apaga apenas dados de aplicacao. NUNCA apaga auth.users.
 */
// @ts-ignore - Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import { E2eCleanupSchemas } from "../_shared/contracts/schemas/e2e-cleanup.ts";

type E2ERateLimitRow = {
  allowed: boolean;
  reset_in_seconds?: number;
  current_count?: number;
};

const corsHeaders = buildPublicCorsHeaders({ extraAllowHeaders: ["x-e2e-cleanup-token"], allowMethods: "POST, OPTIONS" });
let contractResponseHeaders: Record<string, string> = {};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLEANUP_TOKEN = Deno.env.get("E2E_CLEANUP_TOKEN") ?? "";
const ALLOWED_EMAILS_RAW = Deno.env.get("E2E_CLEANUP_ALLOWED_EMAILS") ?? "";
const ALLOWED_EMAILS = new Set(
  ALLOWED_EMAILS_RAW.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);
const RATE_LIMIT_MAX = Math.max(1, Number(Deno.env.get("E2E_CLEANUP_RATE_LIMIT_MAX") ?? "30"));
const RATE_LIMIT_WINDOW = Math.max(10, Number(Deno.env.get("E2E_CLEANUP_RATE_LIMIT_WINDOW_SECONDS") ?? "60"));

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startMs = Date.now();
  const clientIp = getClientIp(req);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Auth
  const incomingToken = req.headers.get("x-e2e-cleanup-token") ?? "";
  if (!CLEANUP_TOKEN || !timingSafeEqual(incomingToken, CLEANUP_TOKEN)) {
    await supabase.from("e2e_cleanup_audit").insert({
      ip: clientIp, status: "auth_failed", reason: "invalid_token",
      dry_run: true, total_ms: Date.now() - startMs,
    }).maybeSingle();
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const contractResult = await parseContract(req, E2eCleanupSchemas, { corsHeaders });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;
    contractResponseHeaders = responseHeaders;

    const email = (body.email ?? '').toLowerCase();
    const dryRun = body.dryRun !== false;

    // 2. Rate limit
    const rlResult = await castRpcResult<{ data: E2ERateLimitRow | null; error: unknown }>(
      supabase.rpc("e2e_cleanup_check_rate_limit", {
        p_ip: clientIp,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW,
        // deno-lint-ignore no-explicit-any
      }) as unknown as Promise<{ data: E2ERateLimitRow | null; error: unknown }>
    );
    if (rlResult.data && !rlResult.data.allowed) {
      await supabase.from("e2e_cleanup_audit").insert({
        ip: clientIp, status: "rate_limited", reason: "rate_limit_exceeded",
        dry_run: dryRun, total_ms: Date.now() - startMs,
      }).maybeSingle();
      return jsonResponse(
        { ok: false, error: "Rate limit exceeded", reset_in_seconds: rlResult.data.reset_in_seconds },
        429
      );
    }

    // 3. Email allowlist
    if (ALLOWED_EMAILS.size > 0 && !ALLOWED_EMAILS.has(email)) {
      await supabase.from("e2e_cleanup_audit").insert({
        ip: clientIp, status: "forbidden", reason: "email_not_allowed",
        dry_run: dryRun, total_ms: Date.now() - startMs,
      }).maybeSingle();
      return jsonResponse({ ok: false, error: "Email not in allowed list" }, 403);
    }

    // 4. Resolve user_id
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    const targetUser = users?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!targetUser) {
      return jsonResponse({ ok: false, error: "User not found", email }, 404);
    }
    const userId = targetUser.id;

    // 5. Cleanup (application data only)
    const deleted: Record<string, number> = {};
    const tables = [
      { table: "quotes", column: "seller_id" },
      { table: "orders", column: "seller_id" },
      { table: "quote_items", column: "seller_id" },
      { table: "workspace_notifications", column: "user_id" },
      { table: "follow_up_reminders", column: "seller_id" },
      { table: "mockup_drafts", column: "user_id" },
      { table: "favorites", column: "user_id" },
    ];

    if (!dryRun) {
      for (const { table, column } of tables) {
        const { count, error } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq(column, userId);
        if (!error) deleted[table] = count ?? 0;
      }
    } else {
      for (const { table, column } of tables) {
        const { count } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq(column, userId);
        deleted[table] = count ?? 0;
      }
    }

    const totalMs = Date.now() - startMs;
    await supabase.from("e2e_cleanup_audit").insert({
      ip: clientIp, status: "success", dry_run: dryRun,
      user_id: userId, totals: deleted, total_ms: totalMs,
    }).maybeSingle();

    return jsonResponse({ ok: true, dryRun, userId, deleted, totalMs });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[e2e-cleanup] error:", msg);
    await supabase.from("e2e_cleanup_audit").insert({
      ip: clientIp, status: "error", reason: msg,
      dry_run: true, total_ms: Date.now() - startMs,
    }).maybeSingle();
    return jsonResponse({ ok: false, error: "Internal error" }, 500);
  }
});
