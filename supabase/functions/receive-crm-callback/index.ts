/**
 * receive-crm-callback
 * --------------------------------------------------------------
 * Endpoint receptor de callbacks do CRM Promo Champions V2.
 *
 * Contrato:
 *   POST /functions/v1/receive-crm-callback
 *   Headers:
 *     - content-type: application/json
 *     - x-api-key:    <CRM_CALLBACK_API_KEY>  (comparação timing-safe)
 *   Body: ver `CallbackSchema` abaixo.
 *
 * Aplica o efeito em `public.quotes` conforme `event_type` e registra
 * todo evento (sucesso, duplicado ou erro) em `public.crm_callback_events`.
 * Idempotente por (external_quote_id, event_type, occurred_at).
 *
 * Auth: verify_jwt=false no config.toml + validação inline via x-api-key.
 * CORS: SSOT via _shared/cors.ts (buildPublicCorsHeaders).
 * Logs: JSON estruturado via _shared/structured-logger.ts.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { buildPublicCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { RateLimiter } from "../_shared/rate-limiter.ts";
import { resolveCredential } from "../_shared/credentials.ts";

const CORS = buildPublicCorsHeaders({ extraAllowHeaders: ["x-api-key"] });

// Rate limit: 300 req/min por (IP + hash da api-key). Fail-open p/ não
// derrubar callbacks legítimos quando o storage de rate-limit estiver
// indisponível — mas ainda bloqueia abuso previsível.
const rl = new RateLimiter({
  maxRequests: 300,
  windowMs: 60 * 1000,
  keyPrefix: "rl:crm-callback",
  failClosed: false,
});

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- Zod schema
/**
 * SSOT dos event_type aceitos. Espelha o CHECK constraint
 * `chk_crm_callback_events_event_type` no banco canônico. Qualquer
 * mudança aqui exige migration correspondente (e vice-versa).
 */
export const ALLOWED_EVENT_TYPES = [
  "approved",
  "rejected",
  "order_created",
  "sent_to_client",
  "expired",
] as const;
export type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];
export function isAllowedEventType(v: unknown): v is AllowedEventType {
  return typeof v === "string" && (ALLOWED_EVENT_TYPES as readonly string[]).includes(v);
}
const EventTypeEnum = z.enum(ALLOWED_EVENT_TYPES);

export const CallbackSchema = z.object({
  external_quote_id: z.string().uuid(),
  crm_quote_id: z.string().uuid().optional(),
  event_type: EventTypeEnum,
  status: z.string().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  payload: z
    .object({
      order_id: z.string().uuid().optional(),
      order_number: z.string().max(64).optional(),
      rejection_reason: z.string().max(2000).optional(),
      approved_by: z.string().max(255).optional(),
      total_value: z.number().finite().optional(),
    })
    .catchall(z.any())
    .default({}),
});
export type CallbackBody = z.infer<typeof CallbackSchema>;

// ---------------------------------------------------------------- helpers
function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", ...extra },
  });
}

/** Comparação constant-time (evita timing attack no api-key). */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// ---------------------------------------------------------------- handler
// Limites de defesa em profundidade
const MAX_BODY_BYTES = 64 * 1024;                    // 64KB: DoS-guard
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;            // 5min: clock skew tolerado
const MAX_PAST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;  // 7d: anti-replay

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req, { public: true, extraAllowHeaders: ["x-api-key"] });
  if (preflight) return preflight;

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "receive-crm-callback", requestId, req });

  if (req.method !== "POST") {
    return log.respond(json(405, { error: "method_not_allowed" }));
  }

    // 1) auth — resolveCredential handles DB-first (integration_credentials) + env fallback
  const { value: _expectedRaw } = await resolveCredential("CRM_CALLBACK_API_KEY");
  const expected: string = _expectedRaw ?? "";
  const provided = req.headers.get("x-api-key") ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    log.warn("crm_callback_unauthorized", { has_env: expected.length > 0, has_header: provided.length > 0 });
    return log.respond(json(401, { error: "invalid_api_key" }));
  }
  // 1.b) rate-limit por (IP + hash da api-key). Bloqueia abuso mesmo
  //      com credencial válida (chave vazada ou caller descontrolado).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const keyHash = (await sha256Hex(provided)).slice(0, 16);
  const rlKey = `${ip}:${keyHash}`;
  const rlRes = await rl.check(rlKey);
  if (!rlRes.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rlRes.resetAt - Date.now()) / 1000));
    log.warn("crm_callback_rate_limited", { ip, key_hash: keyHash, reset_at: rlRes.resetAt, retry_after: retryAfter });
    return log.respond(
      json(
        429,
        { error: "rate_limited", retry_after_seconds: retryAfter },
        { "retry-after": String(retryAfter) },
      ),
    );
  }
  if (rlRes.suspicious) {
    log.warn("crm_callback_rate_suspicious", { ip, key_hash: keyHash, remaining: rlRes.remaining });
  }

  // 2) payload size guard (defense-in-depth vs. DoS)
  const declaredLen = Number(req.headers.get("content-length") ?? "0");
  if (declaredLen > MAX_BODY_BYTES) {
    log.warn("crm_callback_payload_too_large", { declared_len: declaredLen, limit: MAX_BODY_BYTES });
    return log.respond(json(413, { error: "payload_too_large", limit_bytes: MAX_BODY_BYTES }));
  }
  // Leitura crua (fallback caso content-length venha ausente/mentiroso)
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    log.warn("crm_callback_payload_too_large", { actual_len: rawText.length, limit: MAX_BODY_BYTES });
    return log.respond(json(413, { error: "payload_too_large", limit_bytes: MAX_BODY_BYTES }));
  }

  // 3) parse + validate
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return log.respond(json(400, { error: "invalid_json" }));
  }
  const parsed = CallbackSchema.safeParse(raw);
  if (!parsed.success) {
    return log.respond(
      json(400, {
        error: "invalid_payload",
        details: parsed.error.flatten(),
      }),
    );
  }
  const body = parsed.data;

  // Contexto padrão anexado a TODA linha de log deste request após o parse.
  // Facilita grep por request_id/external_quote_id/event_type no Log Explorer.
  const ctx = {
    external_quote_id: body.external_quote_id,
    crm_quote_id: body.crm_quote_id ?? null,
    event_type: body.event_type,
    occurred_at: body.occurred_at,
  };
  log.info("crm_callback_received", ctx);

  // 3.a) janela anti-replay: rejeita occurred_at muito no passado ou muito no futuro
  const occurredMs = Date.parse(body.occurred_at);
  const nowMs = Date.now();
  if (occurredMs - nowMs > MAX_FUTURE_SKEW_MS) {
    log.warn("crm_callback_future_skew", { ...ctx, skew_ms: occurredMs - nowMs, limit_ms: MAX_FUTURE_SKEW_MS });
    return log.respond(json(400, { error: "occurred_at_in_future", limit_ms: MAX_FUTURE_SKEW_MS }));
  }
  if (nowMs - occurredMs > MAX_PAST_WINDOW_MS) {
    log.warn("crm_callback_too_old", { ...ctx, age_ms: nowMs - occurredMs, limit_ms: MAX_PAST_WINDOW_MS });
    return log.respond(json(400, { error: "occurred_at_too_old", limit_ms: MAX_PAST_WINDOW_MS }));
  }

  // 3) supabase admin client (service role — writes bypass RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    log.error("crm_callback_missing_env", ctx);
    return log.respond(json(500, { error: "internal_error", message: "missing_env" }));
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 4) Defense-in-depth: mesmo com Zod validando, checamos a whitelist
  //    antes do INSERT para evitar bater no CHECK do banco e queimar
  //    conexão / gerar 500. Se um dia alguém remover o Zod, isto ainda
  //    protege o CHECK constraint `chk_crm_callback_events_event_type`.
  if (!isAllowedEventType(body.event_type)) {
    log.warn("crm_callback_invalid_event_type", {
      ...ctx,
      received: body.event_type,
      allowed: ALLOWED_EVENT_TYPES,
    });
    return log.respond(
      json(400, {
        error: "invalid_event_type",
        received: body.event_type,
        allowed: ALLOWED_EVENT_TYPES,
      }),
    );
  }

  // 5) idempotência: INSERT ON CONFLICT DO NOTHING
  //    Se já existir para (external_quote_id, event_type, occurred_at) → duplicate_ignored.
  const insertRes = await supabase
    .from("crm_callback_events")
    .insert({
      external_quote_id: body.external_quote_id,
      crm_quote_id: body.crm_quote_id ?? null,
      event_type: body.event_type,
      occurred_at: body.occurred_at,
      payload: body.payload,
      result: "applied", // valor otimista; atualizamos abaixo em erro
    })
    .select("id")
    .maybeSingle();

  // conflito de idempotência (unique violation)
  if (insertRes.error && (insertRes.error as any).code === "23505") {
    log.info("crm_callback_duplicate", ctx);
    return log.respond(json(200, { status: "duplicate_ignored" }));
  }
  // CHECK constraint violation (event_type fora da whitelist do banco).
  // Só chega aqui se whitelist do código e do DB divergirem — sinaliza
  // drift de schema e devolve 422 (semantic) em vez de 500 opaco.
  if (insertRes.error && (insertRes.error as any).code === "23514") {
    log.error("crm_callback_check_violation", {
      ...ctx,
      constraint: (insertRes.error as any).details ?? null,
      message: insertRes.error.message,
    });
    return log.respond(
      json(422, {
        error: "constraint_violation",
        hint: "event_type rejeitado pelo CHECK do banco — schema drift entre edge e DB.",
      }),
    );
  }
  if (insertRes.error) {
    log.error("crm_callback_insert_failed", { ...ctx, err: insertRes.error });
    return log.respond(json(500, { error: "internal_error", message: "audit_insert_failed" }));
  }
  const eventId = insertRes.data?.id as string | undefined;

  // 5) aplicar efeito no quotes via RPC fn_apply_crm_callback
  // fix_version=2026-07-09-rcb-build6 ANTI-REGRESSÃO
  // Usa RPC em vez de supabase.from("quotes").update() para:
  //   a) COALESCE(sent_at, occurred_at) — preserva data da PRIMEIRA vez enviado
  //   b) Lógica de mapping centralizada no banco (SSOT)
  //   c) Retorno estruturado (affected, applied, detail)
  const rpcRes = await supabase.rpc("fn_apply_crm_callback", {
    p_quote_id:        body.external_quote_id,
    p_event_type:      body.event_type,
    p_occurred_at:     body.occurred_at,
    p_approved_by:     body.payload.approved_by     ?? null,
    p_rejection_reason: body.payload.rejection_reason ?? null,
    p_order_id:        body.payload.order_id         ?? null,
    p_order_number:    body.payload.order_number      ?? null,
  });

  // Adaptar formato de resposta para o restante do código
  const upd = {
    error: rpcRes.error,
    data: rpcRes.data && rpcRes.data.length > 0 && rpcRes.data[0].applied
      ? [{ id: body.external_quote_id }]
      : (rpcRes.error ? null : []),
    _rpcResult: rpcRes.data?.[0] ?? null,
  } as any;

  // Se RPC retornou applied=false (sem erro) → quote_not_found
  if (!upd.error && rpcRes.data?.[0] && !rpcRes.data[0].applied) {
    upd.data = [];
  }

  if (upd.error) {
    // fix_version=2026-07-09-rcb-build5 ANTI-REGRESSÃO
    // Distinguir erros transientes (→ 500, CRM retenta) de erros semânticos
    // que não devem gerar retry (ex: trigger de validação, quote inexistente,
    // erro de permissão isolado). Esses erros retornam 200/applied:false.
    //
    // Códigos semânticos que NÃO devem gerar retry no CRM:
    //   42501 = insufficient_privilege (trigger de validação de role/desconto)
    //   23514 = check_violation (regra de desconto)
    //   P0001 = raise_exception genérico de trigger (outros triggers)
    const errCode = (upd.error as any).code ?? "";
    const errMsg  = upd.error.message ?? "";
    const isTriggerError =
      errCode === "42501" ||   // insufficient_privilege (is_coord_or_above)
      errCode === "23514" ||   // check_violation (desconto acima do limite)
      errCode === "P0001" ||   // raise_exception genérico de PL/pgSQL
      errMsg.includes("forbidden:") ||
      errMsg.includes("cannot query role");

    await supabase
      .from("crm_callback_events")
      .update({ result: "error", error_message: errMsg })
      .eq("id", eventId!);

    if (isTriggerError) {
      // Erro semântico: evento auditado, quote não atualizada, sem retry no CRM.
      log.warn("crm_callback_trigger_blocked", {
        ...ctx, event_id: eventId,
        err_code: errCode, err_msg: errMsg,
      });
      return log.respond(
        json(200, {
          status: "ok",
          event_id: eventId,
          applied: false,
          reason: "quote_update_blocked",
          detail: errMsg,
        }),
      );
    }

    // Erro transiente (DB down, timeout, etc.) → 500 para CRM retentar.
    log.error("crm_callback_update_failed", { ...ctx, event_id: eventId, err: upd.error });
    return log.respond(json(500, { error: "internal_error", message: "quote_update_failed" }));
  }

  const affected = upd.data?.length ?? 0;
  if (affected === 0) {
    // Política acordada com o PO: 200 + result=error (não gera retry no CRM).
    await supabase
      .from("crm_callback_events")
      .update({ result: "error", error_message: "quote_not_found" })
      .eq("id", eventId!);
    log.warn("crm_callback_quote_not_found", { ...ctx, event_id: eventId });
    return log.respond(
      json(200, {
        status: "ok",
        event_id: eventId,
        applied: false,
        reason: "quote_not_found",
      }),
    );
  }

  log.info("crm_callback_applied", { ...ctx, event_id: eventId, applied_fields: [body.event_type], rpc_detail: upd._rpcResult?.detail ?? null });
  return log.respond(json(200, { status: "ok", event_id: eventId, applied: true }));
});

// ---------------------------------------------------------------- mapping (DEPRECATED — BUILD=6 usa fn_apply_crm_callback RPC)
// fix_version=2026-07-09-rcb-build6 ANTI-REGRESSÃO: buildQuoteUpdates mantida para
// referência histórica. A lógica vive agora em public.fn_apply_crm_callback no banco.
/**
 * @deprecated BUILD=6: use fn_apply_crm_callback RPC. Mantida para referência.
 * Mapeia o evento do CRM para colunas existentes em `public.quotes`
 * do banco canônico `doufsxqlfjyuvxuezpln`. Colunas ausentes no schema
 * (ex.: rejection_reason, order_number) são armazenadas apenas no
 * payload jsonb da tabela de auditoria.
 */
function buildQuoteUpdates(body: CallbackBody): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  switch (body.event_type) {
    case "approved":
      patch.status = "approved";
      patch.approved_at = body.occurred_at;
      patch.client_response = "approved";
      patch.client_response_at = body.occurred_at;
      if (body.payload.approved_by) patch.approved_by_client_name = body.payload.approved_by;
      break;
    case "rejected":
      patch.status = "rejected";
      patch.client_response = "rejected";
      patch.client_response_at = body.occurred_at;
      if (body.payload.rejection_reason) patch.client_feedback = body.payload.rejection_reason;
      break;
    case "order_created":
      patch.status = "converted";
      patch.converted_at = body.occurred_at;
      if (body.payload.order_id) patch.converted_to_order_id = body.payload.order_id;
      if (body.payload.order_number) {
        patch.conversion_notes = `Pedido criado no CRM: ${body.payload.order_number}`;
      }
      break;
    case "sent_to_client":
      patch.last_sent_at = body.occurred_at;
      if (!("sent_at" in patch)) patch.sent_at = body.occurred_at;
      break;
    case "expired":
      patch.status = "expired";
      break;
  }
  return patch;
}
