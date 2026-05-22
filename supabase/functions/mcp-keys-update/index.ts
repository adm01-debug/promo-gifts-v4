import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * mcp-keys-update
 *
 * Atualiza campos sensíveis de uma chave MCP (name, description, scopes, expires_at).
 * Toda mudança é auditada com request_id, payload_summary, duração e status.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  KNOWN_SCOPES,
  FULL_SCOPE_CONFIRMATION,
  FULL_SCOPE_MIN_JUSTIFICATION,
  FULL_SCOPE_MAX_TTL_MS,
  isFullAccess,
} from "../_shared/mcp-scopes.ts";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { writeAuditEntry, summarizePayload, extractRequestMeta } from "../_shared/audit-log.ts";
import { recordMcpViolation, mapViolationReason } from "../_shared/mcp-violations.ts";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { buildValidationErrorV2, buildValidationErrorV2FromFields } from "../_shared/validation-errors.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};

type RpcEnvelope<T> = { data: T | null; error: { message: string } | null };

const SOURCE = "mcp-keys-update";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z.object({
  key_id: z.string().uuid(),
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  scopes: z
    .array(z.enum(KNOWN_SCOPES as unknown as [string, ...string[]]))
    .min(1)
    .max(KNOWN_SCOPES.length)
    .optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  justification: z.string().trim().max(1000).optional().nullable(),
  confirmation_phrase: z.string().optional().nullable(),
  /** Token de step-up (senha + OTP) — obrigatório para escalar para FULL. */
  step_up_token: z.string().min(32).max(256).optional().nullable(),
});

function jsonResponse(body: unknown, status: number, requestId: string) {
  return new Response(JSON.stringify({ ...(body as object), request_id: requestId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", [REQUEST_ID_HEADER]: requestId },
  });
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = getOrCreateRequestId(req);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const { ip, ua } = extractRequestMeta(req);

  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, requestId);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  let rawBody: unknown = null;

  const auditFailure = async (
    status: "error" | "denied",
    extra: Record<string, unknown>,
    resourceId?: string | null,
  ) => {
    await writeAuditEntry(admin, {
      user_id: userId,
      action: status === "denied" ? "mcp_key.update_denied" : "mcp_key.update_error",
      resource_type: "mcp_api_key",
      resource_id: resourceId ?? null,
      ip_address: ip,
      user_agent: ua,
      request_id: requestId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      status,
      payload_summary: summarizePayload(rawBody),
      source: SOURCE,
      details: extra,
    });
    if (status === "denied") {
      await recordMcpViolation(admin, {
        userId,
        reason: mapViolationReason(extra?.reason),
        source: SOURCE,
        operation: "update",
        targetKeyId: resourceId ?? null,
        ip, userAgent: ua, requestId,
        details: extra,
      });
    }
  };

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      await auditFailure("denied", { reason: "unauthenticated" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      await auditFailure("denied", { reason: "invalid_jwt" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }
    userId = userData.user.id;

    const { data: roleCheck, error: roleErr } = await castRpcResult<RpcEnvelope<boolean>>(
      admin.rpc("is_dev", { _user_id: userId }),
    );
    if (roleErr) {
      await auditFailure("error", { reason: "role_check_failed", detail: roleErr.message });
      return jsonResponse({ error: "internal_error", detail: roleErr.message }, 500, requestId);
    }
    if (!roleCheck) {
      await auditFailure("denied", { reason: "not_dev" });
      return jsonResponse({ error: "forbidden", message: "Apenas desenvolvedores podem editar chaves MCP." }, 403, requestId);
    }

    try { rawBody = await req.json(); } catch {
      await auditFailure("error", { reason: "invalid_json" });
      return jsonResponse({ error: "invalid_json" }, 400, requestId);
    }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      await auditFailure("denied", { reason: "validation_failed", fields });
      return jsonResponse(buildValidationErrorV2(parsed.error), 422, requestId);
    }
    const { key_id, name, description, scopes, expires_at, justification, confirmation_phrase, step_up_token } = parsed.data;

    const { data: current, error: fetchErr } = await admin
      .from("mcp_api_keys")
      .select("id, name, description, scopes, expires_at, revoked_at, key_prefix")
      .eq("id", key_id)
      .maybeSingle();
    if (fetchErr) {
      await auditFailure("error", { reason: "fetch_failed", detail: fetchErr.message }, key_id);
      return jsonResponse({ error: "internal_error", detail: fetchErr.message }, 500, requestId);
    }
    if (!current) {
      await auditFailure("denied", { reason: "not_found" }, key_id);
      return jsonResponse({ error: "not_found" }, 404, requestId);
    }
    if (current.revoked_at) {
      await auditFailure("denied", { reason: "revoked_key" }, key_id);
      return jsonResponse({ error: "policy_violation", message: "Chave revogada não pode ser editada." }, 422, requestId);
    }

    const wasFull = isFullAccess(current.scopes ?? []);
    const willBeFull = scopes ? isFullAccess(scopes) : wasFull;
    const escalating = !wasFull && willBeFull;

    if (escalating) {
      // Step-up obrigatório: senha + OTP validados nos últimos 5min, role dev re-checada server-side
      if (!step_up_token) {
        await auditFailure("denied", { reason: "step_up_required" }, key_id);
        return jsonResponse(
          { error: "step_up_required", message: "Confirme sua identidade (senha + código por e-mail) antes de escalar a chave para escopo total." },
          403,
          requestId,
        );
      }
      const { data: stepUpOk, error: stepUpErr } = await castRpcResult<RpcEnvelope<boolean>>(
        userClient.rpc("consume_step_up_token", {
          _token: step_up_token,
          _expected_action: "mcp_full_escalate",
          _expected_target: key_id,
        }),
      );
      if (stepUpErr || !stepUpOk) {
        await auditFailure("denied", { reason: "step_up_invalid", detail: stepUpErr?.message }, key_id);
        return jsonResponse(
          { error: "step_up_invalid", message: "Verificação dupla expirou ou é inválida. Refaça a confirmação." },
          403,
          requestId,
        );
      }

      // Authorization gate: only explicit grantors can escalate to FULL
      const { data: canGrant, error: grantErr } = await castRpcResult<RpcEnvelope<boolean>>(
        admin.rpc("can_grant_mcp_full", { _user_id: userId }),
      );
      if (grantErr) {
        await auditFailure("error", { reason: "grant_check_failed", detail: grantErr.message }, key_id);
        return jsonResponse({ error: "internal_error", detail: grantErr.message }, 500, requestId);
      }
      if (!canGrant) {
        await auditFailure("denied", { reason: "full_grant_forbidden" }, key_id);
        return jsonResponse(
          {
            error: "full_grant_forbidden",
            message: "Você não tem permissão para escalar chaves MCP para escopo total (*). Solicite a inclusão em mcp_full_grantors.",
          },
          403,
          requestId,
        );
      }

      const fieldErrors: Record<string, string[]> = {};
      if (!justification || justification.trim().length < FULL_SCOPE_MIN_JUSTIFICATION) {
        fieldErrors.justification = [`Justificativa obrigatória (mín. ${FULL_SCOPE_MIN_JUSTIFICATION} caracteres) para escalar para FULL.`];
      }
      if (confirmation_phrase !== FULL_SCOPE_CONFIRMATION) {
        fieldErrors.confirmation_phrase = [`Digite exatamente "${FULL_SCOPE_CONFIRMATION}" para confirmar escalação.`];
      }
      const newExpiry = expires_at ?? current.expires_at;
      if (!newExpiry) {
        fieldErrors.expires_at = ["Chaves FULL exigem data de expiração."];
      } else {
        const ms = new Date(newExpiry).getTime() - Date.now();
        if (ms <= 0) fieldErrors.expires_at = [...(fieldErrors.expires_at ?? []), "Expiração precisa ser futura."];
        else if (ms > FULL_SCOPE_MAX_TTL_MS) fieldErrors.expires_at = [...(fieldErrors.expires_at ?? []), "Janela máxima 180 dias."];
      }
      if (Object.keys(fieldErrors).length > 0) {
        await auditFailure("denied", { reason: "full_escalation_blocked", fields: fieldErrors }, key_id);
        return jsonResponse(
          buildValidationErrorV2FromFields(fieldErrors, { code: "full_escalation_blocked" }),
          422,
          requestId,
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (scopes !== undefined) patch.scopes = scopes;
    if (expires_at !== undefined) patch.expires_at = expires_at;

    if (Object.keys(patch).length === 0) {
      await auditFailure("denied", { reason: "no_changes" }, key_id);
      return jsonResponse({ error: "no_changes" }, 400, requestId);
    }

    const { data: updated, error: updErr } = await admin
      .from("mcp_api_keys")
      .update(patch)
      .eq("id", key_id)
      .select("id, name, description, scopes, expires_at, key_prefix")
      .single();
    if (updErr || !updated) {
      await auditFailure("error", { reason: "update_failed", detail: updErr?.message ?? "unknown" }, key_id);
      return jsonResponse({ error: "update_failed", detail: updErr?.message ?? "unknown" }, 500, requestId);
    }

    await writeAuditEntry(admin, {
      user_id: userId,
      action: "mcp_key.updated",
      resource_type: "mcp_api_key",
      resource_id: updated.id,
      ip_address: ip,
      user_agent: ua,
      request_id: requestId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      status: "success",
      payload_summary: summarizePayload(rawBody),
      source: SOURCE,
      details: {
        key_prefix: updated.key_prefix,
        fields_changed: Object.keys(patch),
        before: {
          name: current.name,
          description: current.description,
          scopes: current.scopes,
          expires_at: current.expires_at,
        },
        after: {
          name: updated.name,
          description: updated.description,
          scopes: updated.scopes,
          expires_at: updated.expires_at,
        },
        escalated_to_full: escalating,
        justification: escalating ? (justification ?? null) : null,
      },
    });

    // Auditoria explícita de concessão FULL (escalada)
    if (escalating) {
      try {
        await userClient.rpc("log_full_scope_grant", {
          _operation: "escalate",
          _key_id: updated.id,
          _key_prefix: updated.key_prefix,
          _justification: justification ?? null,
          _confirmation_phrase_ok: confirmation_phrase === FULL_SCOPE_CONFIRMATION,
          _expires_at: updated.expires_at,
          _ip: ip,
          _user_agent: ua,
          _request_id: requestId,
          _extra: {
            previous_scopes: current.scopes,
            new_scopes: updated.scopes,
          },
        });
      } catch (e) {
        await writeAuditEntry(admin, {
          user_id: userId,
          action: "mcp_key.audit_log_failed",
          resource_type: "mcp_api_key",
          resource_id: updated.id,
          status: "error",
          source: SOURCE,
          request_id: requestId,
          started_at: new Date().toISOString(),
          details: { reason: "log_full_scope_grant_failed", detail: (e as Error).message },
        });
      }
    }

    return jsonResponse({ ok: true, key: updated, escalated_to_full: escalating }, 200, requestId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await auditFailure("error", { reason: "uncaught", detail });
    return jsonResponse({ error: "internal_error", detail }, 500, requestId);
  }
});
