import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
// connections-health-check: cron-driven (every 15min). Re-tests every active
// connection, notifies admins on transitions (active→error), on auto-disabled
// outbound webhooks and on stale secrets (>90 days). Dedupe 4h per (key) to
// avoid notification spam. The "connection_down" incident additionally requires
// a continuous-failure window (configurable via RPC
// `set_connection_failure_window_minutes`, default 30min) to suppress flapping.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";

const DEDUPE_WINDOW_HOURS = 4;
const STALE_SECRET_DAYS = 90;
const DEFAULT_FAILURE_WINDOW_MINUTES = 30;

interface IncidentKey {
  key: string;
  title: string;
  message: string;
  type: "warning" | "error";
}

async function alreadyNotified(
  service: import("../_shared/supabase-client-adapter.ts").CompatibleSupabaseClient,
  userId: string,
  key: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from("workspace_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("category", "integrations")
    .gte("created_at", since)
    .filter("metadata->>incident_key", "eq", key)
    .limit(1);
  return (data ?? []).length > 0;
}

async function notifyAdmins(
  service: import("../_shared/supabase-client-adapter.ts").CompatibleSupabaseClient,
  adminIds: string[],
  incident: IncidentKey,
) {
  for (const userId of adminIds) {
    if (await alreadyNotified(service, userId, incident.key)) continue;
    await service.from("workspace_notifications").insert({
      user_id: userId,
      title: incident.title,
      message: incident.message,
      type: incident.type,
      category: "integrations",
      action_url: "/admin/conexoes",
      metadata: { incident_key: incident.key, source: "connections-health-check" },
      is_read: false,
    });
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: admins } = await service
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((a: { user_id: string }) => a.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incidents: IncidentKey[] = [];

    // 1) Auto-disabled outbound webhooks
    const { data: disabled } = await service
      .from("outbound_webhooks")
      .select("id, name, auto_disabled_reason")
      .not("auto_disabled_at", "is", null)
      .eq("active", false);
    for (const w of disabled ?? []) {
      incidents.push({
        key: `webhook_disabled:${w.id}`,
        title: "Webhook desativado automaticamente",
        message: `${w.name} — ${w.auto_disabled_reason ?? "circuit breaker acionado"}.`,
        type: "error",
      });
    }

    // 2) Stale secrets (>90d sem rotação)
    const cutoff = new Date(Date.now() - STALE_SECRET_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await service
      .from("secret_rotation_log")
      .select("secret_name, rotated_at")
      .lt("rotated_at", cutoff);
    // Aggregate by secret_name (most recent rotation per name)
    const lastBySecret = new Map<string, string>();
    for (const s of stale ?? []) {
      const prev = lastBySecret.get(s.secret_name);
      if (!prev || s.rotated_at > prev) lastBySecret.set(s.secret_name, s.rotated_at);
    }
    for (const [secret_name] of lastBySecret) {
      incidents.push({
        key: `stale_secret:${secret_name}`,
        title: "Secret precisa ser rotacionado",
        message: `${secret_name} sem rotação há mais de ${STALE_SECRET_DAYS} dias.`,
        type: "warning",
      });
    }

    // 3) Connections that have been failing CONTINUOUSLY for at least
    //    `failure_window_minutes` (configurable). A "connection_down" incident
    //    is only emitted if every recorded test inside that window failed —
    //    transient flaps that already recovered are ignored.
    let failureWindowMin = DEFAULT_FAILURE_WINDOW_MINUTES;
    try {
      const { data: rpcData } = await castRpcResult<{
        data: number | null;
        error: { message: string } | null;
      }>(service.rpc("get_connection_failure_window_minutes"));
      if (typeof rpcData === "number" && rpcData >= 0) failureWindowMin = rpcData;
    } catch (_) { /* keep default */ }

    if (failureWindowMin === 0) {
      // Window disabled → behave like the legacy "any failure in last hour" rule.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: down } = await service
        .from("external_connections")
        .select("id, name, type, last_test_message, last_test_at")
        .eq("last_test_ok", false)
        .gte("last_test_at", oneHourAgo);
      for (const c of down ?? []) {
        incidents.push({
          key: `connection_down:${c.id}`,
          title: `Conexão ${c.type} com erro`,
          message: `${c.name} — ${c.last_test_message ?? "ping falhou"}.`,
          type: "error",
        });
      }
    } else {
      const windowStart = new Date(Date.now() - failureWindowMin * 60 * 1000).toISOString();
      const { data: candidates } = await service
        .from("external_connections")
        .select("id, name, type, last_test_message, last_test_at")
        .eq("last_test_ok", false);
      for (const c of candidates ?? []) {
        // Need at least one test inside the window AND zero successes inside it.
        const [{ data: anyInWindow }, { count: successesInWindow }] = await Promise.all([
          service.from("connection_test_history")
            .select("id")
            .eq("connection_id", c.id)
            .gte("tested_at", windowStart)
            .limit(1),
          service.from("connection_test_history")
            .select("id", { count: "exact", head: true })
            .eq("connection_id", c.id)
            .eq("success", true)
            .gte("tested_at", windowStart),
        ]);
        const hasTests = (anyInWindow ?? []).length > 0;
        const hadSuccess = (successesInWindow ?? 0) > 0;
        if (!hasTests || hadSuccess) continue;

        incidents.push({
          key: `connection_down:${c.id}`,
          title: `Conexão ${c.type} com erro`,
          message: `${c.name} — falhando há ≥${failureWindowMin}min. Último erro: ${c.last_test_message ?? "ping falhou"}.`,
          type: "error",
        });
      }
    }

    let notified = 0;
    for (const inc of incidents) {
      const before = notified;
      await notifyAdmins(service, adminIds, inc);
      // Approximate count (notifyAdmins may dedupe internally)
      notified = before + adminIds.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        incidents: incidents.length,
        admins: adminIds.length,
        keys: incidents.map((i) => i.key),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return safeErrorResponse(err, { corsHeaders, publicMessage: "internal_error", logLabel: "connections-health-check error:" });
  }
});
