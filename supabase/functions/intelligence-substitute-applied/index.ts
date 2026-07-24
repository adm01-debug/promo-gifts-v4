// supabase/functions/intelligence-substitute-applied/index.ts
//
// Espelha o evento client-side `intelligence.substitute_applied` no pipeline
// `ai_usage_events`, permitindo medir a conversão diagnóstico → recuperação
// (usuário aplicou um substituto ranqueado após receber um diagnóstico de
// resultado zero em /inteligencia-comercial) junto com as demais métricas
// de IA da plataforma.
//
// - JWT obrigatório (via `authenticateRequest`)
// - Zod-valida o payload (mesmo contrato do client)
// - Insert idempotente-por-request-id: usa o header X-Request-Id como parte
//   do metadata para deduplicar retries do lado do cliente sem custo de
//   índice único (o painel de admin consome `ai_usage_events` que já é
//   append-only por natureza).
// - Fire-and-forget: retorna 202 assim que o insert é aceito; erros de RLS
//   ou schema mudam para 5xx para que o client possa monitorar.

import { z } from "https://esm.sh/zod@3.23.8";

import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const FUNCTION_NAME = "intelligence-substitute-applied";
const EVENT_TYPE = "substitute_applied";

const corsHeaders = buildPublicCorsHeaders();

const AxisEnum = z.enum(["categoryId", "supplierId", "productId"]);
const CulpritEnum = z.enum([
  "categoryId",
  "supplierId",
  "productId",
  "window",
  "intersection",
]);

const BodySchema = z.object({
  axis: AxisEnum,
  substituteId: z.string().min(1).max(128),
  substituteName: z.string().max(255).nullable().optional(),
  days: z.number().int().min(1).max(365),
  culpritBefore: CulpritEnum.nullable().optional(),
  /** Timestamp emitido pelo cliente — preservado no metadata para conciliação. */
  clientTs: z.string().datetime().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: FUNCTION_NAME, requestId, req });

  if (req.method !== "POST") {
    return log.respond(
      new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  // 1. Auth
  let auth;
  try {
    auth = await authenticateRequest(req);
  } catch (err) {
    log.warn("auth_failed", { err });
    return log.respond(authErrorResponse(err, corsHeaders));
  }

  // 2. Validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    log.warn("invalid_json");
    return log.respond(
      new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    log.warn("invalid_payload", {
      issues: parsed.error.flatten().fieldErrors,
    });
    return log.respond(
      new Response(
        JSON.stringify({
          error: "invalid_payload",
          issues: parsed.error.flatten().fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    );
  }
  const payload = parsed.data;

  // 3. Insert into ai_usage_events (service role — RLS permite ao próprio user
  // via policy `Users can insert their own usage events`; usamos service role
  // apenas para escrever o `user_id` autenticado sem depender do JWT no PostgREST).
  const { error: insertErr } = await auth.localServiceClient
    .from("ai_usage_events")
    .insert({
      user_id: auth.userId,
      function_name: FUNCTION_NAME,
      event_type: EVENT_TYPE,
      metadata: {
        axis: payload.axis,
        substitute_id: payload.substituteId,
        substitute_name: payload.substituteName ?? null,
        days: payload.days,
        culprit_before: payload.culpritBefore ?? null,
        client_ts: payload.clientTs ?? null,
        request_id: requestId,
        source: "client_mirror",
      },
    });

  if (insertErr) {
    log.error("insert_failed", { err: insertErr });
    return log.respond(
      new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  log.info("event_recorded", {
    axis: payload.axis,
    substitute_id: payload.substituteId,
    days: payload.days,
    culprit_before: payload.culpritBefore ?? null,
  });

  return log.respond(
    new Response(JSON.stringify({ ok: true, request_id: requestId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  );
});
