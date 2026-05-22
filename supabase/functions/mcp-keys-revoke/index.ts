import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * mcp-keys-revoke
 *
 * Revoga uma chave MCP server-side, registrando IP/UA + request_id +
 * payload_summary antes do trigger DB.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { writeAuditEntry, summarizePayload, extractRequestMeta } from "../_shared/audit-log.ts";
import { recordMcpViolation, mapViolationReason } from "../_shared/mcp-violations.ts";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { buildValidationErrorV2 } from "../_shared/validation-errors.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};

type RpcEnvelope<T> = { data: T | null; error: { message: string } | null };

const SOURCE = "mcp-keys-revoke";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z.object({
  key_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
  /** Token de step-up (senha + OTP) — obrigatório para revogar qualquer chave MCP. */
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
    action: string,
    extra: Record<string, unknown>,
    resourceId?: string | null,
  ) => {
    await writeAuditEntry(admin, {
      user_id: userId,
      action,
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
        operation: "revoke",
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
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "unauthenticated" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "invalid_jwt" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }
    userId = userData.user.id;

    const { data: roleCheck, error: roleErr } = await castRpcResult<RpcEnvelope<boolean>>(
      admin.rpc("is_dev", { _user_id: userId }),
    );
    if (roleErr) {
      await auditFailure("error", "mcp_key.revoke_error", { reason: "role_check_failed", detail: roleErr.message });
      return jsonResponse({ error: "internal_error", detail: roleErr.message }, 500, requestId);
    }
    if (!roleCheck) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "not_dev" });
      return jsonResponse({ error: "forbidden", message: "Apenas desenvolvedores podem revogar chaves MCP." }, 403, requestId);
    }

    try { rawBody = await req.json(); } catch {
      await auditFailure("error", "mcp_key.revoke_error", { reason: "invalid_json" });
      return jsonResponse({ error: "invalid_json" }, 400, requestId);
    }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "validation_failed", fields });
      return jsonResponse(buildValidationErrorV2(parsed.error), 422, requestId);
    }
    const { key_id, reason, step_up_token } = parsed.data;

    // Step-up OBRIGATÓRIO antes de revogar qualquer chave MCP.
    // Revogação tem efeito imediato em todas as integrações; exigimos confirmação por
    // senha + OTP recente (validados em consume_step_up_token, que re-checa is_dev no consumo).
    if (!step_up_token) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "step_up_required" }, key_id);
      return jsonResponse(
        { error: "step_up_required", message: "Confirme sua identidade (senha + código por e-mail) antes de revogar uma chave MCP." },
        403,
        requestId,
      );
    }
    const { data: stepUpOk, error: stepUpErr } = await castRpcResult<RpcEnvelope<boolean>>(
      userClient.rpc("consume_step_up_token", {
        _token: step_up_token,
        _expected_action: "mcp_key_revoke",
        _expected_target: key_id,
      }),
    );
    if (stepUpErr || !stepUpOk) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "step_up_invalid", detail: stepUpErr?.message, expected_action: "mcp_key_revoke" }, key_id);
      return jsonResponse(
        { error: "step_up_invalid", message: "Verificação dupla expirou ou é inválida. Refaça a confirmação." },
        403,
        requestId,
      );
    }

    const { data: existing, error: fetchErr } = await admin
      .from("mcp_api_keys")
      .select("id, key_prefix, name, scopes, revoked_at")
      .eq("id", key_id)
      .maybeSingle();
    if (fetchErr) {
      await auditFailure("error", "mcp_key.revoke_error", { reason: "fetch_failed", detail: fetchErr.message }, key_id);
      return jsonResponse({ error: "internal_error", detail: fetchErr.message }, 500, requestId);
    }
    if (!existing) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "not_found" }, key_id);
      return jsonResponse({ error: "not_found" }, 404, requestId);
    }
    if (existing.revoked_at) {
      await auditFailure("denied", "mcp_key.revoke_denied", { reason: "already_revoked" }, key_id);
      return jsonResponse({ error: "already_revoked" }, 409, requestId);
    }

    // postgrest-js 2.95+ removeu .then/.catch do RPC builder — usar try/catch.
    // Falhas em set_config são silenciadas (best-effort para o trigger de auditoria).
    try {
      await admin.rpc("set_config" as never, { setting_name: "request.mcp_actor", new_value: userId, is_local: true } as never);
    } catch {
      // intentionally swallowed
    }

    const revokedAt = new Date().toISOString();
    const { error: updErr } = await admin
      .from("mcp_api_keys")
      .update({ revoked_at: revokedAt })
      .eq("id", key_id);
    if (updErr) {
      await auditFailure("error", "mcp_key.revoke_error", { reason: "update_failed", detail: updErr.message }, key_id);
      return jsonResponse({ error: "update_failed", detail: updErr.message }, 500, requestId);
    }

    await writeAuditEntry(admin, {
      user_id: userId,
      action: "mcp_key.revoked",
      resource_type: "mcp_api_key",
      resource_id: existing.id,
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
        key_prefix: existing.key_prefix,
        name: existing.name,
        scopes: existing.scopes,
        is_full_access: (existing.scopes ?? []).includes("*"),
        revoked_at: revokedAt,
        reason: reason ?? null,
      },
    });

    return jsonResponse({ ok: true, id: existing.id, revoked_at: revokedAt }, 200, requestId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await auditFailure("error", "mcp_key.revoke_error", { reason: "uncaught", detail });
    return jsonResponse({ error: "internal_error", detail }, 500, requestId);
  }
});
