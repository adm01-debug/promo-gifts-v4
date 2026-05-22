import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * mcp-keys-rotate
 *
 * Duplica uma chave MCP existente preservando nome+escopos+expiração,
 * vinculando a nova à antiga via `rotated_from`. A chave antiga
 * NÃO é revogada automaticamente. Auditoria com request_id e payload_summary.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  FULL_SCOPE_CONFIRMATION,
  FULL_SCOPE_MIN_JUSTIFICATION,
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

const SOURCE = "mcp-keys-rotate";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z.object({
  source_key_id: z.string().uuid(),
  justification: z.string().trim().max(1000).optional().nullable(),
  confirmation_phrase: z.string().optional().nullable(),
  /** Token de step-up (senha + OTP) — obrigatório ao rotacionar chave FULL. */
  step_up_token: z.string().min(32).max(256).optional().nullable(),
});

function jsonResponse(body: unknown, status: number, requestId: string) {
  return new Response(JSON.stringify({ ...(body as object), request_id: requestId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", [REQUEST_ID_HEADER]: requestId },
  });
}

async function generateKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const plain = `mcp_${hex}`;
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { plain, hash, prefix: plain.slice(0, 12) };
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
      action: status === "denied" ? "mcp_key.rotate_denied" : "mcp_key.rotate_error",
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
        operation: "rotate",
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
      return jsonResponse({ error: "forbidden", message: "Apenas desenvolvedores podem rotacionar chaves MCP." }, 403, requestId);
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
    const { source_key_id, justification, confirmation_phrase, step_up_token } = parsed.data;

    const { data: source, error: srcErr } = await admin
      .from("mcp_api_keys")
      .select("id, name, scopes, expires_at, revoked_at, key_prefix")
      .eq("id", source_key_id)
      .maybeSingle();
    if (srcErr) {
      await auditFailure("error", { reason: "fetch_failed", detail: srcErr.message }, source_key_id);
      return jsonResponse({ error: "internal_error", detail: srcErr.message }, 500, requestId);
    }
    if (!source) {
      await auditFailure("denied", { reason: "source_not_found" }, source_key_id);
      return jsonResponse({ error: "source_not_found" }, 404, requestId);
    }
    if (source.revoked_at) {
      await auditFailure("denied", { reason: "source_revoked" }, source_key_id);
      return jsonResponse({ error: "policy_violation", message: "Chave de origem está revogada." }, 422, requestId);
    }

    const full = isFullAccess(source.scopes ?? []);

    // Step-up OBRIGATÓRIO para QUALQUER rotação (full ou limitada).
    // Rotacionar = emitir nova credencial; trata-se com o mesmo nível de fricção.
    if (!step_up_token) {
      await auditFailure("denied", { reason: "step_up_required", scope: full ? "full" : "scoped" }, source_key_id);
      return jsonResponse(
        { error: "step_up_required", message: "Confirme sua identidade (senha + código por e-mail) antes de rotacionar uma chave MCP." },
        403,
        requestId,
      );
    }
    // Para chaves full mantemos a action mais forte 'mcp_full_issue' (frontend já a usa).
    // Para chaves limitadas usamos 'mcp_key_rotate' — mesmo fluxo, auditoria distinta.
    const expectedStepUp = full ? "mcp_full_issue" : "mcp_key_rotate";
    const { data: stepUpOk, error: stepUpErr } = await castRpcResult<RpcEnvelope<boolean>>(
      userClient.rpc("consume_step_up_token", {
        _token: step_up_token,
        _expected_action: expectedStepUp,
        _expected_target: source_key_id,
      }),
    );
    if (stepUpErr || !stepUpOk) {
      await auditFailure("denied", { reason: "step_up_invalid", detail: stepUpErr?.message, expected_action: expectedStepUp }, source_key_id);
      return jsonResponse(
        { error: "step_up_invalid", message: "Verificação dupla expirou ou é inválida. Refaça a confirmação." },
        403,
        requestId,
      );
    }

    if (full) {

      // Authorization gate: only explicit grantors can rotate (re-emit) FULL keys
      const { data: canGrant, error: grantErr } = await castRpcResult<RpcEnvelope<boolean>>(
        admin.rpc("can_grant_mcp_full", { _user_id: userId }),
      );
      if (grantErr) {
        await auditFailure("error", { reason: "grant_check_failed", detail: grantErr.message }, source_key_id);
        return jsonResponse({ error: "internal_error", detail: grantErr.message }, 500, requestId);
      }
      if (!canGrant) {
        await auditFailure("denied", { reason: "full_grant_forbidden" }, source_key_id);
        return jsonResponse(
          {
            error: "full_grant_forbidden",
            message: "Você não tem permissão para rotacionar chaves MCP com escopo total (*). Solicite a inclusão em mcp_full_grantors.",
          },
          403,
          requestId,
        );
      }

      const fieldErrors: Record<string, string[]> = {};
      if (!justification || justification.trim().length < FULL_SCOPE_MIN_JUSTIFICATION) {
        fieldErrors.justification = [`Justificativa obrigatória (mín. ${FULL_SCOPE_MIN_JUSTIFICATION} caracteres) para rotacionar chave full.`];
      }
      if (confirmation_phrase !== FULL_SCOPE_CONFIRMATION) {
        fieldErrors.confirmation_phrase = [`Digite exatamente "${FULL_SCOPE_CONFIRMATION}" para confirmar.`];
      }
      if (Object.keys(fieldErrors).length > 0) {
        await auditFailure("denied", { reason: "full_friction_failed", fields: fieldErrors }, source_key_id);
        return jsonResponse(
          buildValidationErrorV2FromFields(fieldErrors, { code: "full_friction_failed" }),
          422,
          requestId,
        );
      }
    }

    const { plain, hash, prefix } = await generateKey();
    const newName = `${source.name} (rotacionada)`;

    const { data: inserted, error: insertErr } = await admin
      .from("mcp_api_keys")
      .insert({
        name: newName,
        key_hash: hash,
        key_prefix: prefix,
        scopes: source.scopes,
        created_by: userId,
        expires_at: source.expires_at,
        rotated_from: source.id,
        description: justification ?? null,
      })
      .select("id, key_prefix, scopes, expires_at, created_at, rotated_from")
      .single();
    if (insertErr || !inserted) {
      await auditFailure("error", { reason: "insert_failed", detail: insertErr?.message ?? "unknown" }, source_key_id);
      return jsonResponse({ error: "insert_failed", detail: insertErr?.message ?? "unknown" }, 500, requestId);
    }

    await writeAuditEntry(admin, {
      user_id: userId,
      action: "mcp_key.rotated",
      resource_type: "mcp_api_key",
      resource_id: inserted.id,
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
        new_key_prefix: inserted.key_prefix,
        source_id: source.id,
        source_prefix: source.key_prefix,
        scopes: inserted.scopes,
        is_full_access: full,
        justification: justification ?? null,
        expires_at: inserted.expires_at,
      },
    });

    // Auditoria explícita de concessão FULL (correlaciona token/challenge/chave)
    if (full) {
      try {
        await userClient.rpc("log_full_scope_grant", {
          _operation: "rotate",
          _key_id: inserted.id,
          _key_prefix: inserted.key_prefix,
          _justification: justification ?? null,
          _confirmation_phrase_ok: confirmation_phrase === FULL_SCOPE_CONFIRMATION,
          _expires_at: inserted.expires_at,
          _ip: ip,
          _user_agent: ua,
          _request_id: requestId,
          _extra: { source_id: source.id, source_prefix: source.key_prefix },
        });
      } catch (e) {
        await writeAuditEntry(admin, {
          user_id: userId,
          action: "mcp_key.audit_log_failed",
          resource_type: "mcp_api_key",
          resource_id: inserted.id,
          status: "error",
          source: SOURCE,
          request_id: requestId,
          started_at: new Date().toISOString(),
          details: { reason: "log_full_scope_grant_failed", detail: (e as Error).message },
        });
      }
    }

    return jsonResponse(
      {
        ok: true,
        key: plain,
        prefix: inserted.key_prefix,
        scopes: inserted.scopes,
        expires_at: inserted.expires_at,
        id: inserted.id,
        rotated_from: inserted.rotated_from,
        is_full_access: full,
      },
      200,
      requestId,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await auditFailure("error", { reason: "uncaught", detail });
    return jsonResponse({ error: "internal_error", detail }, 500, requestId);
  }
});
