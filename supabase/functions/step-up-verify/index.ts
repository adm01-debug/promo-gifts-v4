import { getCorsHeaders } from "../_shared/cors.ts";
// Edge function: step-up auth (senha + OTP por e-mail) com re-checagem de role dev
// Audit log: registra TODAS as transições do fluxo (requested, password_verified,
// password_failed, otp_failed, issued, cancelled, unauthorized) com action,
// target_ref e action_label para rastreabilidade humana.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  StepUpVerifySchemas,
} from "../_shared/contracts/schemas/step-up-verify.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};
// Module-scope contract response headers (Deprecation/Sunset) — setado após parseContract OK.
let contractResponseHeaders: Record<string, string> = {};

type RpcEnvelope<T> = { data: T | null; error: { message: string } | null };
type StepUpChallengeRow = { challenge_id: string; otp_plain: string; expires_at: string };
type StepUpOtpRow = { token: string; expires_at: string };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action =
  | "promote_dev"
  | "demote_dev"
  | "mcp_full_issue"
  | "mcp_full_escalate"
  | "mcp_key_revoke"
  | "mcp_key_rotate"
  | "secret_rotation"
  | "secret_revoke";

interface RequestBody {
  step: "request" | "verify_password" | "verify_otp" | "cancel";
  action?: Action;
  action_label?: string;
  target_ref?: string | null;
  challenge_id?: string;
  password?: string;
  otp?: string;
  /** Para step="cancel": motivo opcional (ex.: "user_closed_dialog", "client_error"). */
  cancel_reason?: string;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

/** Trunca strings longas para evitar metadata gigante. */
function safeLabel(label: string | undefined | null, max = 200): string | null {
  if (!label || typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  contractResponseHeaders = {};
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  /** Helper de audit consistente: sempre inclui action, target_ref, action_label. */
  const audit = async (params: {
    user_id: string | null;
    event_type: string;
    action?: Action | null;
    target_ref?: string | null;
    action_label?: string | null;
    challenge_id?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await admin.from("step_up_audit_log").insert({
        user_id: params.user_id,
        event_type: params.event_type,
        action: params.action ?? null,
        target_ref: params.target_ref ?? null,
        challenge_id: params.challenge_id ?? null,
        ip_address: ip,
        user_agent: ua,
        metadata: {
          ...(params.metadata ?? {}),
          action_label: params.action_label ?? null,
        },
      });
    } catch (_) {
      // Audit best-effort: nunca quebra fluxo principal.
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await audit({
        user_id: null,
        event_type: "unauthorized",
        metadata: { reason: "missing_auth_header" },
      });
      return json({ error: "unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      await audit({
        user_id: null,
        event_type: "unauthorized",
        metadata: { reason: "invalid_jwt" },
      });
      return json({ error: "unauthorized" }, 401);
    }

    const contractResult = await parseContract(req, StepUpVerifySchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const body = contractResult.data as RequestBody;
    contractResponseHeaders = contractResult.responseHeaders;
    const action = body.action ?? null;
    const targetRef = body.target_ref ?? null;
    const actionLabel = safeLabel(body.action_label);

    // Re-checagem server-side de role dev
    const { data: isDev } = await castRpcResult<RpcEnvelope<boolean>>(
      admin.rpc("is_dev", { _user_id: user.id }),
    );
    if (!isDev) {
      await audit({
        user_id: user.id,
        event_type: "unauthorized",
        action,
        target_ref: targetRef,
        action_label: actionLabel,
        challenge_id: body.challenge_id ?? null,
        metadata: { reason: "not_dev_at_edge", step: body.step },
      });
      return json({ error: "forbidden", reason: "dev_role_required" }, 403);
    }

    // ---------- STEP 1: request challenge + envia OTP por e-mail ----------
    if (body.step === "request") {
      if (!action) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          target_ref: targetRef,
          action_label: actionLabel,
          metadata: { reason: "action_required", step: "request" },
        });
        return json({ error: "action_required" }, 400);
      }

      const { data, error } = await castRpcResult<
        RpcEnvelope<StepUpChallengeRow | StepUpChallengeRow[]>
      >(userClient.rpc("request_step_up_challenge", {
        _action: action,
        _target_ref: targetRef,
        _ip: ip,
        _user_agent: ua,
      }));
      if (error) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          metadata: { reason: "rpc_error", detail: error.message, step: "request" },
        });
        return json({ error: error.message }, 429);
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.challenge_id || !row?.otp_plain) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          metadata: { reason: "challenge_failed", step: "request" },
        });
        return json({ error: "challenge_failed" }, 500);
      }

      // Envia OTP por e-mail (best-effort)
      let emailDispatched = true;
      try {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "step-up-otp",
            recipientEmail: user.email,
            idempotencyKey: `stepup-${row.challenge_id}`,
            templateData: { otp: row.otp_plain, action, expiresInMinutes: 5 },
          },
        });
      } catch (_) {
        emailDispatched = false;
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: row.challenge_id,
          metadata: {
            reason: "email_dispatch_failed",
            otp_preview: row.otp_plain.slice(0, 2) + "****",
            step: "request",
          },
        });
      }

      await audit({
        user_id: user.id,
        event_type: "requested",
        action,
        target_ref: targetRef,
        action_label: actionLabel,
        challenge_id: row.challenge_id,
        metadata: { email_dispatched: emailDispatched },
      });

      return json({ challenge_id: row.challenge_id, expires_at: row.expires_at });
    }

    // ---------- STEP 2: verifica senha ----------
    if (body.step === "verify_password") {
      if (!body.challenge_id || !body.password) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: body.challenge_id ?? null,
          metadata: { reason: "missing_fields", step: "verify_password" },
        });
        return json({ error: "missing_fields" }, 400);
      }
      if (!user.email) return json({ error: "no_email" }, 400);

      const verifier = createClient(SUPABASE_URL, ANON_KEY);
      const { error: pErr } = await verifier.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      });
      if (pErr) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: body.challenge_id,
          metadata: { reason: "wrong_password", step: "verify_password" },
        });
        return json({ error: "invalid_password" }, 401);
      }

      const { data: ok, error } = await castRpcResult<RpcEnvelope<boolean>>(
        userClient.rpc("mark_step_up_password_verified", {
          _challenge_id: body.challenge_id,
        }),
      );
      if (error || !ok) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: body.challenge_id,
          metadata: { reason: "challenge_invalid", step: "verify_password" },
        });
        return json({ error: "challenge_invalid" }, 400);
      }

      await audit({
        user_id: user.id,
        event_type: "password_verified",
        action,
        target_ref: targetRef,
        action_label: actionLabel,
        challenge_id: body.challenge_id,
      });

      return json({ password_verified: true });
    }

    // ---------- STEP 3: verifica OTP -> emite token ----------
    if (body.step === "verify_otp") {
      if (!body.challenge_id || !body.otp) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: body.challenge_id ?? null,
          metadata: { reason: "missing_fields", step: "verify_otp" },
        });
        return json({ error: "missing_fields" }, 400);
      }

      const { data, error } = await castRpcResult<
        RpcEnvelope<StepUpOtpRow | StepUpOtpRow[]>
      >(userClient.rpc("verify_step_up_otp", {
        _challenge_id: body.challenge_id,
        _otp: body.otp,
      }));
      if (error) {
        await audit({
          user_id: user.id,
          event_type: "failed",
          action,
          target_ref: targetRef,
          action_label: actionLabel,
          challenge_id: body.challenge_id,
          metadata: { reason: "otp_invalid", detail: error.message, step: "verify_otp" },
        });
        return json({ error: error.message }, 400);
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        // Não deveria acontecer (issue_step_up_token sempre retorna 1 linha
        // ou lança), mas o typecheck Deno exige guard explícito antes do
        // acesso a `row.token`/`row.expires_at`.
        return json({ error: "issue_failed", detail: "no_row_returned" }, 500);
      }

      await audit({
        user_id: user.id,
        event_type: "issued",
        action,
        target_ref: targetRef,
        action_label: actionLabel,
        challenge_id: body.challenge_id,
        metadata: { token_expires_at: row.expires_at ?? null },
      });

      return json({ token: row.token, expires_at: row.expires_at });
    }

    // ---------- STEP 4: cancelamento explícito do cliente ----------
    if (body.step === "cancel") {
      await audit({
        user_id: user.id,
        event_type: "cancelled",
        action,
        target_ref: targetRef,
        action_label: actionLabel,
        challenge_id: body.challenge_id ?? null,
        metadata: {
          reason: body.cancel_reason ?? "user_dismissed",
        },
      });
      return json({ ok: true });
    }

    return json({ error: "invalid_step" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
