import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * mcp-keys-issue
 *
 * Emite uma nova chave MCP server-side.
 *
 * Fluxo:
 *  1. CORS + OPTIONS
 *  2. Autentica via JWT (Authorization: Bearer)
 *  3. Verifica role admin via has_role()
 *  4. Valida payload com Zod (incluindo regras de alçada para escopo "*")
 *  5. Gera chave plana + hash SHA-256 server-side
 *  6. Insere em mcp_api_keys (service_role)
 *  7. Registra em admin_audit_log
 *  8. Retorna a chave plana UMA ÚNICA VEZ
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  KNOWN_SCOPES,
  FULL_SCOPE,
  FULL_SCOPE_CONFIRMATION,
  FULL_SCOPE_MIN_JUSTIFICATION,
  FULL_SCOPE_MAX_TTL_MS,
  isFullAccess,
} from "../_shared/mcp-scopes.ts";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { writeAuditEntry, summarizePayload, extractRequestMeta } from "../_shared/audit-log.ts";
import { recordMcpViolation, mapViolationReason } from "../_shared/mcp-violations.ts";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { buildValidationErrorV2 } from "../_shared/validation-errors.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};

type RpcEnvelope<T> = { data: T | null; error: { message: string } | null };

const SOURCE = "mcp-keys-issue";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    scopes: z
      .array(z.enum(KNOWN_SCOPES as unknown as [string, ...string[]]))
      .min(1)
      .max(KNOWN_SCOPES.length),
    expires_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    justification: z.string().trim().max(1000).optional().nullable(),
    confirmation_phrase: z.string().optional().nullable(),
    step_up_token: z.string().min(32).max(256).optional().nullable(),
    target_repo: z.string().trim().max(200).optional().nullable(),
    target_tool: z.string().trim().max(100).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const full = isFullAccess(data.scopes);
    if (!full) return;

    // Regras adicionais quando escopo "*" está presente.
    if (!data.expires_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: "Chaves com escopo '*' exigem data de expiração.",
      });
    } else {
      const expiresMs = new Date(data.expires_at).getTime();
      const nowMs = Date.now();
      if (Number.isNaN(expiresMs) || expiresMs <= nowMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expires_at"],
          message: "Data de expiração precisa ser no futuro.",
        });
      } else if (expiresMs - nowMs > FULL_SCOPE_MAX_TTL_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expires_at"],
          message: "Janela máxima para chave full é de 180 dias.",
        });
      }
    }

    if (
      !data.justification ||
      data.justification.length < FULL_SCOPE_MIN_JUSTIFICATION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justification"],
        message: `Justificativa obrigatória (mín. ${FULL_SCOPE_MIN_JUSTIFICATION} caracteres) para chave full.`,
      });
    }

    if (data.confirmation_phrase !== FULL_SCOPE_CONFIRMATION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmation_phrase"],
        message: `Digite exatamente "${FULL_SCOPE_CONFIRMATION}" para confirmar.`,
      });
    }
  });

function jsonResponse(body: unknown, status: number, requestId?: string) {
  const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify(requestId ? { ...(body as object), request_id: requestId } : body), {
    status,
    headers,
  });
}

async function generateKey(): Promise<{ plain: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plain = `mcp_${hex}`;
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { plain, hash, prefix: plain.slice(0, 12) };
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const requestId = getOrCreateRequestId(req);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const { ip, ua } = extractRequestMeta(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, requestId);
  }

  // Cliente service-role inicializado cedo para auditoria de erros
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
        operation: "issue",
        targetKeyId: resourceId ?? null,
        ip, userAgent: ua, requestId,
        details: extra,
      });
    }
  };

  try {
    // 1. JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "unauthenticated" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "invalid_jwt" });
      return jsonResponse({ error: "unauthenticated" }, 401, requestId);
    }
    userId = userData.user.id;

    // 3. Role check — apenas DEV pode emitir chaves MCP
    const { data: roleCheck, error: roleErr } = await castRpcResult<RpcEnvelope<boolean>>(
      admin.rpc("is_dev", { _user_id: userId }),
    );
    if (roleErr) {
      await auditFailure("error", "mcp_key.issue_error", { reason: "role_check_failed", detail: roleErr.message });
      return jsonResponse({ error: "internal_error", detail: roleErr.message }, 500, requestId);
    }
    if (!roleCheck) {
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "not_dev" });
      return jsonResponse({ error: "forbidden", message: "Apenas desenvolvedores podem emitir chaves MCP." }, 403, requestId);
    }

    // 4. Validate body
    try {
      rawBody = await req.json();
    } catch {
      await auditFailure("error", "mcp_key.issue_error", { reason: "invalid_json" });
      return jsonResponse({ error: "invalid_json" }, 400, requestId);
    }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "validation_failed", fields });
      return jsonResponse(buildValidationErrorV2(parsed.error), 422, requestId);
    }
    const { name, scopes, expires_at, justification, step_up_token, target_repo, target_tool } = parsed.data;
    const full = isFullAccess(scopes);

    // 4a. Step-up OBRIGATÓRIO para QUALQUER emissão (não apenas full).
    // Toda chave MCP é credencial sensível; exigimos senha + OTP recentes
    // (validados em consume_step_up_token, que também re-checa is_dev no consumo).
    if (!step_up_token) {
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "step_up_required", scope: full ? "full" : "scoped" });
      return jsonResponse(
        { error: "step_up_required", message: "Confirme sua identidade (senha + código por e-mail) antes de emitir uma chave MCP." },
        403,
        requestId,
      );
    }
    // Para chaves full mantemos a action mais forte 'mcp_full_issue' (o frontend já a usa).
    // Para chaves limitadas usamos 'mcp_key_rotate' como ação genérica de mutação de chave —
    // ambas exigem o mesmo fluxo de senha+OTP, mas auditamos diferente.
    const expectedStepUp = full ? "mcp_full_issue" : "mcp_key_rotate";
    const { data: stepUpOk, error: stepUpErr } = await castRpcResult<RpcEnvelope<boolean>>(
      userClient.rpc("consume_step_up_token", {
        _token: step_up_token,
        _expected_action: expectedStepUp,
        _expected_target: null,
      }),
    );
    if (stepUpErr || !stepUpOk) {
      await auditFailure("denied", "mcp_key.issue_denied", { reason: "step_up_invalid", detail: stepUpErr?.message, expected_action: expectedStepUp });
      return jsonResponse(
        { error: "step_up_invalid", message: "Verificação dupla expirou ou é inválida. Refaça a confirmação." },
        403,
        requestId,
      );
    }

    // 4b. Authorization gate adicional para FULL scope: precisa estar em mcp_full_grantors.
    if (full) {
      const { data: canGrant, error: grantErr } = await castRpcResult<RpcEnvelope<boolean>>(
        admin.rpc("can_grant_mcp_full", { _user_id: userId }),
      );
      if (grantErr) {
        await auditFailure("error", "mcp_key.issue_error", { reason: "grant_check_failed", detail: grantErr.message });
        return jsonResponse({ error: "internal_error", detail: grantErr.message }, 500, requestId);
      }
      if (!canGrant) {
        await auditFailure("denied", "mcp_key.issue_denied", {
          reason: "full_grant_forbidden",
          required_permission: "mcp_full_grantors",
        });
        return jsonResponse(
          {
            error: "full_grant_forbidden",
            message: "Você não tem permissão para emitir chaves MCP com escopo total (*). Solicite a um admin já autorizado para incluir você em mcp_full_grantors.",
          },
          403,
          requestId,
        );
      }
    }

    // 5. Generate key
    const { plain, hash, prefix } = await generateKey();

    // 6. Insert
    const { data: inserted, error: insertErr } = await admin
      .from("mcp_api_keys")
      .insert({
        name,
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        created_by: userId,
        expires_at: expires_at ?? null,
        description: justification ?? null,
      })
      .select("id, key_prefix, scopes, expires_at, created_at")
      .single();
    if (insertErr || !inserted) {
      await auditFailure("error", "mcp_key.issue_error", { reason: "insert_failed", detail: insertErr?.message });
      return jsonResponse({ error: "insert_failed", detail: insertErr?.message ?? "unknown" }, 500, requestId);
    }

    // 7. Audit log (success)
    await writeAuditEntry(admin, {
      user_id: userId,
      action: "mcp_key.issued",
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
        key_prefix: inserted.key_prefix,
        scopes: inserted.scopes,
        expires_at: inserted.expires_at,
        is_full_access: full,
        justification: justification ?? null,
        name,
        target_repo: target_repo ?? null,
        target_tool: target_tool ?? null,
        step_up_verified: full ? true : null,
      },
    });

    // 7b. Auditoria explícita de concessão FULL (correlaciona token/challenge/chave)
    if (full) {
      try {
        await userClient.rpc("log_full_scope_grant", {
          _operation: "issue",
          _key_id: inserted.id,
          _key_prefix: inserted.key_prefix,
          _justification: justification ?? null,
          _confirmation_phrase_ok: true,
          _expires_at: inserted.expires_at,
          _ip: ip,
          _user_agent: ua,
          _request_id: requestId,
          _extra: { name, target_repo: target_repo ?? null, target_tool: target_tool ?? null },
        });
      } catch (e) {
        // Não falhar a operação por erro de auditoria — mas registrar no admin log
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

    // 8. Response
    return jsonResponse(
      {
        ok: true,
        key: plain,
        prefix: inserted.key_prefix,
        scopes: inserted.scopes,
        expires_at: inserted.expires_at,
        id: inserted.id,
        is_full_access: full,
      },
      200,
      requestId,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await auditFailure("error", "mcp_key.issue_error", { reason: "uncaught", detail });
    return jsonResponse({ error: "internal_error", detail }, 500, requestId);
  }
});
