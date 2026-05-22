// Edge function: full-op-diagnostics
// ----------------------------------------------------------------------------
// Diagnóstico read-only das 4 verificações server-side que governam
// operações "full" sobre chaves MCP:
//   1. is_dev(uid)                — usuário tem o papel `dev`?
//   2. can_grant_mcp_full(uid)    — usuário pode emitir/atualizar grant `*`?
//   3. validate_mcp_key(plain)    — opcional: dada uma chave em claro, ela é
//                                   válida? (block_reason, scopes, created_by)
//   4. consume_step_up_token(...) — opcional: dado um token recém-emitido,
//                                   ele seria aceito para a ação X / target Y?
//
// IMPORTANTE: este endpoint NÃO escreve nada (sem auditoria, sem revogação,
// sem consumir tokens). O check de `consume_step_up_token` é feito via
// `step-up-introspect` (RPC `inspect_step_up_token`) que NÃO marca o
// token como usado — preserva a possibilidade de execução real depois.
// ----------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

type CheckStatus = "pass" | "fail" | "skipped" | "error";

interface CheckResult {
  id: "is_dev" | "can_grant_mcp_full" | "validate_mcp_key" | "consume_step_up_token";
  label: string;
  status: CheckStatus;
  detail: string;
  data?: Record<string, unknown> | null;
  duration_ms: number;
}

const BodySchema = z.object({
  // Dry-run de validate_mcp_key. Quando ausente, esse check é "skipped".
  mcp_key_plain: z.string().min(8).max(512).optional(),
  // Dry-run de step-up. Quando ausente, esse check é "skipped".
  step_up_token: z.string().min(8).max(512).optional(),
  step_up_action: z.string().min(1).max(64).optional(),
  step_up_target_ref: z.string().max(255).nullable().optional(),
});

function jsonResponse(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function timed<T>(fn: () => PromiseLike<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

Deno.serve(async (req: Request) => {
  const pre = handleCorsPreflightIfNeeded(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente "como usuário" para identificá-lo a partir do JWT do header.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "unauthenticated" }, 401, req);
  }
  const userId = userData.user.id;

  // Cliente admin para chamar SECURITY DEFINER RPCs. Todos os checks recebem
  // o uid extraído do JWT — nunca aceitamos um uid arbitrário do body.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: z.infer<typeof BodySchema> = {};
  if (req.headers.get("content-length") !== "0") {
    let raw: unknown;
    try { raw = await req.json(); } catch { raw = {}; }
    const parsed = BodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, getCorsHeaders(req));
    }
    body = parsed.data;
  }

  const checks: CheckResult[] = [];

  // ---------- 1. is_dev ----------
  try {
    const { value, ms } = await timed(() => admin.rpc("is_dev", { _user_id: userId }));
    if (value.error) {
      checks.push({
        id: "is_dev", label: "is_dev(uid)", status: "error",
        detail: value.error.message, duration_ms: ms,
      });
    } else {
      const ok = value.data === true;
      checks.push({
        id: "is_dev",
        label: "is_dev(uid)",
        status: ok ? "pass" : "fail",
        detail: ok
          ? "Usuário possui o papel `dev` ativo."
          : "Usuário NÃO possui o papel `dev`. Operações full são bloqueadas em qualquer edge function.",
        data: { result: value.data },
        duration_ms: ms,
      });
    }
  } catch (e) {
    checks.push({
      id: "is_dev", label: "is_dev(uid)", status: "error",
      detail: e instanceof Error ? e.message : String(e), duration_ms: 0,
    });
  }

  // ---------- 2. can_grant_mcp_full ----------
  try {
    const { value, ms } = await timed(() => admin.rpc("can_grant_mcp_full", { _user_id: userId }));
    if (value.error) {
      checks.push({
        id: "can_grant_mcp_full", label: "can_grant_mcp_full(uid)", status: "error",
        detail: value.error.message, duration_ms: ms,
      });
    } else {
      const ok = value.data === true;
      checks.push({
        id: "can_grant_mcp_full",
        label: "can_grant_mcp_full(uid)",
        status: ok ? "pass" : "fail",
        detail: ok
          ? "Usuário consta em `mcp_full_grantors` ativo — pode emitir/atualizar grants escopo `*`."
          : "Usuário NÃO está autorizado como grantor. Emissão/atualização de chaves escopo `*` será negada.",
        data: { result: value.data },
        duration_ms: ms,
      });
    }
  } catch (e) {
    checks.push({
      id: "can_grant_mcp_full", label: "can_grant_mcp_full(uid)", status: "error",
      detail: e instanceof Error ? e.message : String(e), duration_ms: 0,
    });
  }

  // ---------- 3. validate_mcp_key (opcional, dry-run) ----------
  if (body.mcp_key_plain) {
    try {
      const { value, ms } = await timed(() =>
        admin.rpc("validate_mcp_key", { _key_plain: body.mcp_key_plain! }),
      );
      if (value.error) {
        checks.push({
          id: "validate_mcp_key", label: "validate_mcp_key(plain)", status: "error",
          detail: value.error.message, duration_ms: ms,
        });
      } else {
        const row = Array.isArray(value.data) ? value.data[0] : value.data;
        const keyId = row?.key_id ?? null;
        const block = row?.block_reason ?? null;
        if (!keyId) {
          checks.push({
            id: "validate_mcp_key",
            label: "validate_mcp_key(plain)",
            status: "fail",
            detail: "Chave inexistente, mal-formada ou hash não bate. Nenhum key_id retornado.",
            data: { row: row ?? null },
            duration_ms: ms,
          });
        } else if (block) {
          checks.push({
            id: "validate_mcp_key",
            label: "validate_mcp_key(plain)",
            status: "fail",
            detail: `Chave bloqueada server-side. block_reason = "${block}".`,
            data: {
              key_id: keyId,
              scopes: row?.scopes ?? [],
              created_by: row?.created_by ?? null,
              block_reason: block,
            },
            duration_ms: ms,
          });
        } else {
          checks.push({
            id: "validate_mcp_key",
            label: "validate_mcp_key(plain)",
            status: "pass",
            detail: `Chave válida e ativa (scopes: ${(row?.scopes ?? []).join(", ") || "—"}).`,
            data: {
              key_id: keyId,
              scopes: row?.scopes ?? [],
              created_by: row?.created_by ?? null,
            },
            duration_ms: ms,
          });
        }
      }
    } catch (e) {
      checks.push({
        id: "validate_mcp_key", label: "validate_mcp_key(plain)", status: "error",
        detail: e instanceof Error ? e.message : String(e), duration_ms: 0,
      });
    }
  } else {
    checks.push({
      id: "validate_mcp_key",
      label: "validate_mcp_key(plain)",
      status: "skipped",
      detail: "Forneça uma chave em claro para validar (não é registrada nem auditada).",
      duration_ms: 0,
    });
  }

  // ---------- 4. consume_step_up_token (introspecção, NÃO consome) ----------
  if (body.step_up_token && body.step_up_action) {
    try {
      // Inspeção read-only direta na tabela step_up_tokens via service role.
      // NÃO chamamos `consume_step_up_token` aqui porque ele marca o token
      // como usado — quebraria a operação real subsequente.
      const { value, ms } = await timed(async () => {
        // Hash SHA-256 do token (mesma lógica da função SQL `consume_step_up_token`).
        const enc = new TextEncoder().encode(body.step_up_token!);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        const hash = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return admin
          .from("step_up_tokens")
          .select("id, user_id, action, target_ref, expires_at, used_at, created_at")
          .eq("token_hash", hash)
          .maybeSingle();
      });

      if (value.error) {
        checks.push({
          id: "consume_step_up_token", label: "consume_step_up_token(token, action, target)", status: "error",
          detail: value.error.message, duration_ms: ms,
        });
      } else if (!value.data) {
        checks.push({
          id: "consume_step_up_token",
          label: "consume_step_up_token(token, action, target)",
          status: "fail",
          detail: "Token não encontrado (hash não bate). Não foi emitido por este sistema ou já foi removido.",
          duration_ms: ms,
        });
      } else {
        const row = value.data as {
          user_id: string; action: string; target_ref: string | null;
          expires_at: string; used_at: string | null;
        };
        const reasons: string[] = [];
        if (row.user_id !== userId) reasons.push("token pertence a outro usuário");
        if (row.action !== body.step_up_action) reasons.push(`action diverge (esperado "${body.step_up_action}", token "${row.action}")`);
        const expectedTarget = body.step_up_target_ref ?? null;
        if ((row.target_ref ?? null) !== expectedTarget) {
          reasons.push(`target_ref diverge (esperado "${expectedTarget ?? "null"}", token "${row.target_ref ?? "null"}")`);
        }
        if (row.used_at) reasons.push(`já consumido em ${row.used_at}`);
        if (new Date(row.expires_at).getTime() <= Date.now()) reasons.push(`expirado em ${row.expires_at}`);

        if (reasons.length === 0) {
          checks.push({
            id: "consume_step_up_token",
            label: "consume_step_up_token(token, action, target)",
            status: "pass",
            detail: "Token aceitaria o consumo: pertence ao usuário, ação e target batem, não usado e dentro do TTL.",
            data: {
              action: row.action,
              target_ref: row.target_ref,
              expires_at: row.expires_at,
            },
            duration_ms: ms,
          });
        } else {
          checks.push({
            id: "consume_step_up_token",
            label: "consume_step_up_token(token, action, target)",
            status: "fail",
            detail: `Token seria rejeitado: ${reasons.join("; ")}.`,
            data: {
              action: row.action,
              target_ref: row.target_ref,
              expires_at: row.expires_at,
              used_at: row.used_at,
            },
            duration_ms: ms,
          });
        }
      }
    } catch (e) {
      checks.push({
        id: "consume_step_up_token", label: "consume_step_up_token(token, action, target)", status: "error",
        detail: e instanceof Error ? e.message : String(e), duration_ms: 0,
      });
    }
  } else {
    checks.push({
      id: "consume_step_up_token",
      label: "consume_step_up_token(token, action, target)",
      status: "skipped",
      detail: "Forneça token + action (e target_ref se aplicável) para inspeção. Esta verificação NÃO consome o token.",
      duration_ms: 0,
    });
  }

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    skipped: checks.filter((c) => c.status === "skipped").length,
    error: checks.filter((c) => c.status === "error").length,
  };

  return jsonResponse(
    {
      ok: true,
      user_id: userId,
      checked_at: new Date().toISOString(),
      summary,
      checks,
    },
    200,
    req,
  );
});
