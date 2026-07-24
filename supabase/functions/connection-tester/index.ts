import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
// connection-tester: pings external systems to verify connectivity. Admin-only.
// Reads credentials from `integration_credentials` (DB-first) with env fallback.
// Core ping/persistence logic lives in `_shared/connection-test-runner.ts`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { runConnectionTest } from "../_shared/connection-test-runner.ts";

const BodySchema = z.object({
  action: z.enum(["test", "last_test", "test_history", "last_test_full", "consecutive_failures_overview"]).optional().default("test"),
  type: z.enum(["supabase", "bitrix24", "n8n", "mcp", "webhook_outbound"]),
  config: z.record(z.string()).optional(),
  connection_id: z.string().uuid().optional(),
  env_key: z.enum(["promobrind", "crm"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  id: z.string().uuid().optional(),
});

/** Mascaramento server-side de URLs e cabeçalhos sensíveis. */
function maskUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let out = url;
  // Bitrix: /rest/<userId>/<token>/
  out = out.replace(/(\/rest\/\d+\/)[A-Za-z0-9]+(\/)/g, "$1••••$2");
  // ?auth=, ?apikey=, ?token=
  out = out.replace(/([?&](?:auth|apikey|api_key|token|access_token|key)=)[^&#]+/gi, "$1••••");
  return out;
}

function maskHeaders(headers: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!headers) return null;
  const SENSITIVE = /^(authorization|apikey|api-key|x-api-key|x-n8n-api-key|cookie|set-cookie|x-auth-token)$/i;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE.test(k) ? "••••" : String(v);
  }
  return out;
}

function maskBody(body: string | null | undefined): string | null {
  if (!body) return null;
  let out = body;
  out = out.replace(/("(?:authorization|apikey|api_key|token|access_token|password|secret)"\s*:\s*")[^"]+(")/gi, "$1••••$2");
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const service = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", u.user.id);
    // Aceita admin OU dev — alinhado com a guarda <DevRoute /> que protege /admin/conexoes.
    const elevated = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "dev");
    if (!elevated) {
      return new Response(JSON.stringify({ error: "Admin or dev role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { action, type, config = {}, connection_id, env_key, limit, timeout_ms, id: historyId } = parsed.data;

    // -- last_test: read persisted info, no ping --
    if (action === "last_test") {
      let row: {
        last_test_at: string | null;
        last_test_ok: boolean | null;
        last_test_message: string | null;
        last_latency_ms: number | null;
        status: string | null;
      } | null = null;
      if (connection_id) {
        const { data } = await service.from("external_connections")
          .select("last_test_at, last_test_ok, last_test_message, last_latency_ms, status")
          .eq("id", connection_id).maybeSingle();
        row = data ?? null;
      } else if (env_key) {
        const { data } = await service.from("external_connections")
          .select("last_test_at, last_test_ok, last_test_message, last_latency_ms, status")
          .eq("env_key", env_key).eq("type", type).maybeSingle();
        row = data ?? null;
      } else if (type) {
        const { data } = await service.from("external_connections")
          .select("last_test_at, last_test_ok, last_test_message, last_latency_ms, status")
          .eq("type", type).order("last_test_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        row = data ?? null;
      }
      return new Response(JSON.stringify({ ok: true, last: row }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -- test_history: list last N entries from connection_test_history --
    if (action === "test_history") {
      const max = limit ?? 10;
      let connIds: string[] = [];
      if (connection_id) {
        connIds = [connection_id];
      } else if (env_key) {
        const { data } = await service.from("external_connections")
          .select("id").eq("env_key", env_key).eq("type", type);
        connIds = (data ?? []).map((r: { id: string }) => r.id);
      } else {
        const { data } = await service.from("external_connections")
          .select("id").eq("type", type);
        connIds = (data ?? []).map((r: { id: string }) => r.id);
      }
      if (connIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, items: [], total: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [{ data: items }, { count }] = await Promise.all([
        service.from("connection_test_history")
          .select("id, tested_at, success, latency_ms, status_code, error_message, error_kind, triggered_by, attempts")
          .in("connection_id", connIds)
          .order("tested_at", { ascending: false })
          .limit(max),
        service.from("connection_test_history")
          .select("id", { count: "exact", head: true })
          .in("connection_id", connIds),
      ]);
      return new Response(JSON.stringify({
        ok: true,
        items: (items ?? []).map((r: { id: string; tested_at: string; success: boolean; latency_ms: number | null; status_code: number | null; error_message: string | null; error_kind: string | null; triggered_by: string | null; attempts: number | null }) => ({
          id: r.id,
          tested_at: r.tested_at,
          ok: r.success,
          latency_ms: r.latency_ms,
          status: r.status_code,
          message: r.error_message,
          error_kind: r.error_kind,
          triggered_by: r.triggered_by ?? "manual",
          attempts: r.attempts ?? 1,
        })),
        total: count ?? 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -- last_test_full: full record of latest test (or specific by id) --
    if (action === "last_test_full") {
      let rows: unknown[] | null = null;
      if (historyId) {
        const { data } = await service.from("connection_test_history")
          .select("id, tested_at, success, latency_ms, status_code, error_message, error_kind, triggered_by, triggered_by_user_id, request_method, request_url, response_headers, response_body, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms")
          .eq("id", historyId)
          .limit(1);
        rows = data ?? [];
      } else {
        let connIds: string[] = [];
        if (connection_id) {
          connIds = [connection_id];
        } else if (env_key) {
          const { data } = await service.from("external_connections")
            .select("id").eq("env_key", env_key).eq("type", type);
          connIds = (data ?? []).map((r: { id: string }) => r.id);
        } else {
          const { data } = await service.from("external_connections")
            .select("id").eq("type", type)
            .order("last_test_at", { ascending: false, nullsFirst: false }).limit(1);
          connIds = (data ?? []).map((r: { id: string }) => r.id);
        }
        if (connIds.length === 0) {
          return new Response(JSON.stringify({ ok: true, details: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data } = await service.from("connection_test_history")
          .select("id, tested_at, success, latency_ms, status_code, error_message, error_kind, triggered_by, triggered_by_user_id, request_method, request_url, response_headers, response_body, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms")
          .in("connection_id", connIds)
          .order("tested_at", { ascending: false })
          .limit(1);
        rows = data ?? [];
      }
      const row = (rows ?? [])[0] as {
        id: string; tested_at: string; success: boolean;
        latency_ms: number | null; status_code: number | null;
        error_message: string | null; error_kind: string | null;
        triggered_by: string | null; triggered_by_user_id: string | null;
        request_method: string | null; request_url: string | null;
        response_headers: Record<string, string> | null; response_body: string | null;
        dns_ms: number | null; tcp_ms: number | null; tls_ms: number | null;
        ttfb_ms: number | null; download_ms: number | null;
      } | undefined;
      if (!row) {
        return new Response(JSON.stringify({ ok: true, details: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Resolve email of triggering user (best-effort, admin-only context)
      let triggered_by_user_email: string | null = null;
      if (row.triggered_by_user_id) {
        const { data: uu } = await service.auth.admin.getUserById(row.triggered_by_user_id);
        triggered_by_user_email = uu?.user?.email ?? null;
      }
      // Truncate body @ 16KB server-side
      const MAX = 16 * 1024;
      const rawBody = row.response_body ?? null;
      const truncated = !!rawBody && rawBody.length > MAX;
      const body = truncated ? rawBody!.slice(0, MAX) : rawBody;
      return new Response(JSON.stringify({
        ok: true,
        details: {
          id: row.id,
          tested_at: row.tested_at,
          ok: row.success,
          triggered_by: row.triggered_by ?? "manual",
          triggered_by_user_email,
          request: {
            method: row.request_method ?? null,
            url: maskUrl(row.request_url),
          },
          response: {
            status: row.status_code,
            headers: maskHeaders(row.response_headers),
            body: maskBody(body),
            truncated,
          },
          timing: {
            latency_ms: row.latency_ms,
            dns_ms: row.dns_ms,
            tcp_ms: row.tcp_ms,
            tls_ms: row.tls_ms,
            ttfb_ms: row.ttfb_ms,
            download_ms: row.download_ms,
          },
          error: row.success ? null : {
            kind: row.error_kind,
            message: row.error_message,
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -- consecutive_failures_overview: count consecutive failures per connection --
    if (action === "consecutive_failures_overview") {
      const { data: conns } = await service.from("external_connections")
        .select("id, type, env_key");
      const list = (conns ?? []) as Array<{ id: string; type: string; env_key: string | null }>;
      const items: Array<{ key: string; type: string; env_key: string | null; connection_id: string; consecutive_failures: number; since: string | null }> = [];
      // Sequential to limit DB pressure; small N (<= dozens of connections).
      for (const c of list) {
        const { data: hist } = await service.from("connection_test_history")
          .select("tested_at, success")
          .eq("connection_id", c.id)
          .order("tested_at", { ascending: false })
          .limit(50);
        const rows = (hist ?? []) as Array<{ tested_at: string; success: boolean }>;
        let count = 0;
        let since: string | null = null;
        for (const h of rows) {
          if (h.success) break;
          count += 1;
          since = h.tested_at; // last assigned = oldest in the streak
        }
        items.push({
          key: c.id,
          type: c.type,
          env_key: c.env_key,
          connection_id: c.id,
          consecutive_failures: count,
          since,
        });
      }
      return new Response(JSON.stringify({ ok: true, items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await runConnectionTest({
      type,
      config,
      env_key,
      connection_id,
      created_by: u.user.id,
      triggered_by: "manual",
      service,
      timeoutMs: timeout_ms,
    });

    return new Response(JSON.stringify({
      ok: true,
      result: {
        ok: r.ok,
        status: r.status,
        latency_ms: r.latency_ms,
        error: r.error,
        error_kind: r.error_kind,
        message: r.message,
        timeout_ms: r.timeout_ms,
        tested_at: r.tested_at,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, { corsHeaders, publicMessage: "internal_error", logLabel: "connection-tester error:" });
  }
});
