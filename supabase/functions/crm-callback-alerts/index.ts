/**
 * crm-callback-alerts
 * --------------------------------------------------------------
 * Cron job (recomendado: 1x/min) que varre `crm_callback_events`
 * dos últimos N minutos, calcula taxa de falha/exhausted e dispara
 * evento no Sentry quando ultrapassa limiares configuráveis.
 *
 * Thresholds vêm de `system_settings` (chave `crm_callback_alerts`):
 *   {
 *     window_minutes: 5,
 *     min_events: 5,            // ignora se volume for baixo
 *     failure_pct_warn: 20,     // % (warning)
 *     failure_pct_error: 40,    // % (error)
 *     exhausted_abs_error: 3,   // count absoluto de exhausted
 *   }
 * Defaults aplicados quando a chave não existir.
 *
 * Auth: verify_jwt=false (cron server-side). Sem SENTRY_DSN_SERVER → dry-run.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPublicCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const CORS = buildPublicCorsHeaders();

interface Thresholds {
  window_minutes: number;
  min_events: number;
  failure_pct_warn: number;
  failure_pct_error: number;
  exhausted_abs_error: number;
}
const DEFAULTS: Thresholds = {
  window_minutes: 5,
  min_events: 5,
  failure_pct_warn: 20,
  failure_pct_error: 40,
  exhausted_abs_error: 3,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

async function sendSentry(
  dsn: string,
  ev: {
    level: "warning" | "error";
    message: string;
    tags: Record<string, string>;
    extra: Record<string, unknown>;
    fingerprint: string[];
  },
) {
  // Parse DSN: https://<pubkey>@<host>/<project_id>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) throw new Error("invalid_sentry_dsn");
  const [, publicKey, host, projectId] = m;
  const url = `https://${host}/api/${projectId}/envelope/`;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: now, dsn });
  const itemHeader = JSON.stringify({ type: "event" });
  const item = JSON.stringify({
    event_id: eventId,
    timestamp: now,
    platform: "javascript",
    logger: "crm-callback-alerts",
    level: ev.level,
    message: { formatted: ev.message },
    tags: ev.tags,
    extra: ev.extra,
    fingerprint: ev.fingerprint,
  });
  const body = `${envelopeHeader}\n${itemHeader}\n${item}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth":
        `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=deno-fetch/1.0`,
    },
    body,
  });
  return { status: res.status, event_id: eventId };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "crm-callback-alerts", requestId, req });

  if (req.method !== "GET" && req.method !== "POST") {
    return log.respond(json(405, { error: "method_not_allowed" }));
  }

  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) return log.respond(json(500, { error: "missing_env" }));
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  // 1) carregar thresholds
  let cfg: Thresholds = { ...DEFAULTS };
  const { data: sett } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "crm_callback_alerts")
    .maybeSingle();
  if (sett?.value && typeof sett.value === "object") {
    cfg = { ...DEFAULTS, ...(sett.value as Partial<Thresholds>) };
  }

  // 2) contar eventos por result na janela
  const sinceIso = new Date(Date.now() - cfg.window_minutes * 60_000).toISOString();
  const { data: rows, error } = await admin
    .from("crm_callback_events")
    .select("result")
    .gte("created_at", sinceIso);
  if (error) {
    log.error("crm_alerts_read_failed", { err: error });
    return log.respond(json(500, { error: "read_failed" }));
  }

  const counts = { applied: 0, error: 0, exhausted: 0, duplicate_ignored: 0, other: 0, total: 0 };
  for (const r of rows ?? []) {
    counts.total++;
    if (r.result === "applied") counts.applied++;
    else if (r.result === "error") counts.error++;
    else if (r.result === "exhausted") counts.exhausted++;
    else if (r.result === "duplicate_ignored") counts.duplicate_ignored++;
    else counts.other++;
  }
  const failed = counts.error + counts.exhausted;
  const failure_pct = counts.total > 0 ? (100 * failed) / counts.total : 0;

  // 3) decidir severidade
  let severity: "ok" | "warning" | "error" = "ok";
  const reasons: string[] = [];
  if (counts.total >= cfg.min_events) {
    if (failure_pct >= cfg.failure_pct_error) {
      severity = "error";
      reasons.push(`failure_pct>=${cfg.failure_pct_error}`);
    } else if (failure_pct >= cfg.failure_pct_warn) {
      severity = "warning";
      reasons.push(`failure_pct>=${cfg.failure_pct_warn}`);
    }
  }
  if (counts.exhausted >= cfg.exhausted_abs_error) {
    severity = "error";
    reasons.push(`exhausted>=${cfg.exhausted_abs_error}`);
  }

  const summary = {
    request_id: requestId,
    window_minutes: cfg.window_minutes,
    counts,
    failure_pct: Number(failure_pct.toFixed(2)),
    severity,
    reasons,
    cfg,
  };
  log.info("crm_alerts_summary", summary);

  // 4) enviar para Sentry se severity > ok
  const dsn = Deno.env.get("SENTRY_DSN_SERVER");
  let sentry: any = { skipped: severity === "ok" ? "no_alert" : "no_dsn" };
  if (severity !== "ok" && dsn) {
    try {
      sentry = await sendSentry(dsn, {
        level: severity,
        message: `CRM callbacks: ${severity} — ${reasons.join(", ")} (failure_pct=${failure_pct.toFixed(1)}%, exhausted=${counts.exhausted}/${counts.total})`,
        tags: { alert: "crm_callback", source: "crm-callback-alerts", severity },
        extra: summary,
        fingerprint: ["crm-callback-alerts", severity, ...reasons],
      });
    } catch (e) {
      log.error("crm_alerts_sentry_failed", { err: (e as Error).message });
      sentry = { error: (e as Error).message };
    }
  }

  return log.respond(json(200, { ...summary, sentry }));
});
