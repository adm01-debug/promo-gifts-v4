/**
 * crm-callback-reprocess
 * --------------------------------------------------------------
 * Reprocessa dead-letters da tabela `crm_callback_events` re-executando
 * o mapeamento `buildQuoteUpdates` contra `public.quotes`. Idempotente:
 * se `result='applied'` já foi setado, retorna `already_applied`.
 *
 * Modos:
 *   - single:  { event_id: UUID }
 *   - batch:   { batch: true, external_quote_id?: UUID, since?: ISO }
 *
 * Auth: admin/dev only (validate via JWT + user_roles). verify_jwt=false
 * no config para permitir controle inline.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { buildPublicCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const CORS = buildPublicCorsHeaders();

const BodySchema = z.union([
  z.object({ event_id: z.string().uuid() }),
  z.object({
    batch: z.literal(true),
    external_quote_id: z.string().uuid().optional(),
    since: z.string().datetime({ offset: true }).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }),
]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function buildQuoteUpdates(row: any): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = (row.payload ?? {}) as Record<string, any>;
  switch (row.event_type) {
    case "approved":
      patch.status = "approved";
      patch.approved_at = row.occurred_at;
      patch.client_response = "approved";
      patch.client_response_at = row.occurred_at;
      if (p.approved_by) patch.approved_by_client_name = p.approved_by;
      break;
    case "rejected":
      patch.status = "rejected";
      patch.client_response = "rejected";
      patch.client_response_at = row.occurred_at;
      if (p.rejection_reason) patch.client_feedback = p.rejection_reason;
      break;
    case "order_created":
      patch.status = "converted";
      patch.converted_at = row.occurred_at;
      if (p.order_id) patch.converted_to_order_id = p.order_id;
      if (p.order_number) patch.conversion_notes = `Pedido criado no CRM: ${p.order_number}`;
      break;
    case "sent_to_client":
      patch.last_sent_at = row.occurred_at;
      patch.sent_at = row.occurred_at;
      break;
    case "expired":
      patch.status = "expired";
      break;
  }
  return patch;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "crm-callback-reprocess", requestId, req });

  if (req.method !== "POST") return log.respond(json(405, { error: "method_not_allowed" }));

  // Auth: precisa ser admin ou dev
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return log.respond(json(401, { error: "unauthorized" }));
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(
    authHeader.slice(7),
  );
  if (cErr || !claims?.claims?.sub) {
    return log.respond(json(401, { error: "unauthorized" }));
  }
  const uid = claims.claims.sub as string;
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid);
  const rset = new Set((roles ?? []).map((r: any) => r.role));
  if (!rset.has("admin") && !rset.has("dev")) {
    log.warn("crm_reprocess_forbidden", { uid });
    return log.respond(json(403, { error: "forbidden" }));
  }

  // Parse
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return log.respond(json(400, { error: "invalid_json" }));
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return log.respond(json(400, { error: "invalid_payload", details: parsed.error.flatten() }));
  }
  const body = parsed.data as any;

  // Single vs batch
  let rows: any[] = [];
  if ("event_id" in body) {
    const { data, error } = await admin
      .from("crm_callback_events")
      .select("*")
      .eq("id", body.event_id)
      .maybeSingle();
    if (error) return log.respond(json(500, { error: "read_failed", message: error.message }));
    if (!data) return log.respond(json(404, { error: "not_found" }));
    rows = [data];
  } else {
    let q = admin
      .from("crm_callback_events")
      .select("*")
      .in("result", ["error", "exhausted"])
      .order("created_at", { ascending: false })
      .limit(body.limit ?? 100);
    if (body.external_quote_id) q = q.eq("external_quote_id", body.external_quote_id);
    if (body.since) q = q.gte("created_at", body.since);
    const { data, error } = await q;
    if (error) return log.respond(json(500, { error: "read_failed", message: error.message }));
    rows = data ?? [];
  }

  log.info("crm_reprocess_start", { count: rows.length, mode: "event_id" in body ? "single" : "batch" });

  let success = 0;
  let failed = 0;
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of rows) {
    if (row.result === "applied") {
      results.push({ id: row.id, status: "already_applied" });
      continue;
    }
    const updates = buildQuoteUpdates(row);
    const upd = await admin.from("quotes").update(updates).eq("id", row.external_quote_id).select("id");
    if (upd.error) {
      await admin
        .from("crm_callback_events")
        .update({ result: "error", error_message: upd.error.message })
        .eq("id", row.id);
      results.push({ id: row.id, status: "failed", error: upd.error.message });
      failed++;
      continue;
    }
    if ((upd.data?.length ?? 0) === 0) {
      await admin
        .from("crm_callback_events")
        .update({ result: "error", error_message: "quote_not_found" })
        .eq("id", row.id);
      results.push({ id: row.id, status: "quote_not_found" });
      failed++;
      continue;
    }
    await admin
      .from("crm_callback_events")
      .update({ result: "applied", error_message: null })
      .eq("id", row.id);
    results.push({ id: row.id, status: "reprocessed" });
    success++;
  }

  log.info("crm_reprocess_done", { processed: rows.length, success, failed });
  return log.respond(json(200, { processed: rows.length, success, failed, results }));
});
