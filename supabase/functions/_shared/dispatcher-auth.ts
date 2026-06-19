// supabase/functions/_shared/dispatcher-auth.ts
// --------------------------------------------------------------
// Autorização para `webhook-dispatcher`, `connections-auto-test` e crons.
//
// Modos:
//   Modo A — `x-dispatcher-secret: <SECRET>`     (webhook-dispatcher: triggers DB/RPC)
//   Modo B — `Authorization: Bearer <user JWT>`  + role admin|supervisor|dev (frontend)
//   Modo C — `x-cron-secret: <SECRET>`           (cron jobs — agora lê do vault)
//
// Vault-based SoT (15/mai/2026):
//   `authorizeCron` agora lê o secret esperado do vault PostgreSQL via
//   RPC `get_edge_function_secret(_name)` quando service_role está disponível.
//   Fallback para `Deno.env.get()` se vault indisponível (retrocompat).
//   Cache em memória por cold-start: 1 RPC por instância.
//
// Segurança: comparação em tempo constante. Logs estruturados sem expor secret.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export type AppRole = "dev" | "supervisor" | "agente";
const ROLE_RANK: Record<AppRole, number> = { agente: 1, supervisor: 2, dev: 3 };

export type DispatcherAuthMode = "secret" | "user_jwt";
export type CronAuthMode = "secret" | "secret_vault";

export interface DispatcherAuthOk {
  ok: true;
  mode: DispatcherAuthMode;
  user?: { id: string; email?: string; role: AppRole };
  supabaseAdmin: SupabaseClient;
}
export interface DispatcherAuthErr {
  ok: false;
  response: Response;
}
export type DispatcherAuthResult = DispatcherAuthOk | DispatcherAuthErr;

export interface CronAuthOk {
  ok: true;
  mode: CronAuthMode;
}
export type CronAuthResult = CronAuthOk | DispatcherAuthErr;

/**
 * Comparação em tempo constante (constant-time) para evitar timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function logAuthEvent(payload: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ evt: "dispatcher_auth", ts: new Date().toISOString(), ...payload }));
  } catch {
    // logger não pode quebrar a request
  }
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// --------------------------------------------------------------
// Vault secret fetcher — single source of truth para cron secrets.
// Cache em memória durante o cold-start para evitar 1 RPC por request.
// --------------------------------------------------------------

const _vaultCache = new Map<string, Promise<string>>();

async function getVaultSecret(name: string): Promise<string> {
  if (_vaultCache.has(name)) return _vaultCache.get(name)!;
  const promise = (async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) return "";
    try {
      const client = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.rpc("get_edge_function_secret", { _name: name });
      if (error || !data) return "";
      return data as string;
    } catch {
      return "";
    }
  })();
  _vaultCache.set(name, promise);
  return promise;
}

// ============================================================================
// webhook-dispatcher: Modo A (secret) ou Modo B (user JWT)
// ============================================================================

export interface AuthorizeDispatcherOptions {
  /** Se true, exige Modo B (user JWT). Modo A retorna 403. */
  requireUserContext?: boolean;
  /** Role mínimo no Modo B. Default: 'supervisor'. */
  minRole?: AppRole;
  /** CORS headers para response de erro. */
  corsHeaders: Record<string, string>;
}

export async function authorizeDispatcher(
  req: Request,
  opts: AuthorizeDispatcherOptions,
): Promise<DispatcherAuthResult> {
  const { corsHeaders } = opts;
  const minRole: AppRole = opts.minRole ?? "supervisor";
  const requireUserContext = !!opts.requireUserContext;

  const expectedSecret = Deno.env.get("WEBHOOK_DISPATCHER_SECRET") ?? "";
  const providedSecret = req.headers.get("x-dispatcher-secret") ?? "";
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";

  // Modo A: x-dispatcher-secret
  if (providedSecret && expectedSecret) {
    if (!constantTimeEqual(providedSecret, expectedSecret)) {
      logAuthEvent({ outcome: "denied", reason: "bad_secret", mode_attempted: "secret" });
      return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401, corsHeaders) };
    }
    if (requireUserContext) {
      logAuthEvent({ outcome: "denied", reason: "secret_not_allowed_in_user_only_mode" });
      return {
        ok: false,
        response: jsonResponse(
          { error: "user_context_required", message: "Esta operação exige autenticação de usuário (JWT)." },
          403,
          corsHeaders,
        ),
      };
    }
    logAuthEvent({ outcome: "allowed", mode: "secret" });
    return {
      ok: true,
      mode: "secret",
      supabaseAdmin: createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  }

  // Modo B: Bearer user JWT
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      logAuthEvent({ outcome: "denied", reason: "empty_bearer" });
      return { ok: false, response: jsonResponse({ error: "missing_token" }, 401, corsHeaders) };
    }

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userResp, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !userResp?.user) {
      logAuthEvent({ outcome: "denied", reason: "invalid_jwt" });
      return { ok: false, response: jsonResponse({ error: "invalid_token" }, 401, corsHeaders) };
    }

    const userId = userResp.user.id;
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesErr) {
      logAuthEvent({ outcome: "denied", reason: "role_lookup_failed", user_id: userId });
      return { ok: false, response: jsonResponse({ error: "role_lookup_failed" }, 500, corsHeaders) };
    }

    const userRoles = (roles ?? []).map((r) => r.role as AppRole).filter((r) => r in ROLE_RANK);
    const highestRole: AppRole | null = userRoles.length
      ? userRoles.reduce<AppRole>((acc, r) => (ROLE_RANK[r] > ROLE_RANK[acc] ? r : acc), userRoles[0])
      : null;

    const requiredRank = ROLE_RANK[minRole];
    const userRank = highestRole ? ROLE_RANK[highestRole] : 0;
    if (userRank < requiredRank) {
      logAuthEvent({
        outcome: "denied",
        reason: "insufficient_role",
        user_id: userId,
        role_user: highestRole,
        role_required: minRole,
      });
      return {
        ok: false,
        response: jsonResponse(
          { error: "insufficient_role", required: minRole, you_have: highestRole ?? "none" },
          403,
          corsHeaders,
        ),
      };
    }

    logAuthEvent({ outcome: "allowed", mode: "user_jwt", user_id: userId, role: highestRole });
    return {
      ok: true,
      mode: "user_jwt",
      user: { id: userId, email: userResp.user.email ?? undefined, role: highestRole! },
      supabaseAdmin,
    };
  }

  // Fail-closed: secret obrigatório em produção (auditoria SEC-003).
  // Antes aceitávamos chamada anônima como retrocompat ("legacy_no_auth"),
  // o que abria webhook-dispatcher para qualquer caller quando o secret
  // não estava configurado (clones de staging/dev, vault revogado, etc.).
  // Retornamos 401 (não 503): a causa é ausência de credencial configurada,
  // não indisponibilidade do serviço. Fail-closed é mantido.
  if (!expectedSecret) {
    logAuthEvent({
      outcome: "denied",
      reason: "secret_not_configured",
      env: "WEBHOOK_DISPATCHER_SECRET",
    });
    return {
      ok: false,
      response: jsonResponse(
        {
          error: "service_misconfigured",
          message: "WEBHOOK_DISPATCHER_SECRET não configurado. Configure no vault (integration_credentials) ou env antes de invocar.",
        },
        401,
        corsHeaders,
      ),
    };
  }

  // Secret configurado mas chamada sem nenhuma forma de auth → 401
  logAuthEvent({ outcome: "denied", reason: "no_auth_provided" });
  return {
    ok: false,
    response: jsonResponse(
      { error: "missing_authentication", message: "Provide x-dispatcher-secret or Bearer token." },
      401,
      corsHeaders,
    ),
  };
}

// ============================================================================
// crons: Modo C (cron secret) — agora vault-based com fallback env
// ============================================================================

export async function authorizeCron(
  req: Request,
  opts: { corsHeaders: Record<string, string>; secretEnvName: string; headerName: string },
): Promise<CronAuthResult> {
  const { corsHeaders, secretEnvName, headerName } = opts;

  // Vault first (single source of truth), fallback env (retrocompat)
  let expectedSecret = await getVaultSecret(secretEnvName);
  const viaVault = !!expectedSecret;
  if (!expectedSecret) {
    expectedSecret = Deno.env.get(secretEnvName) ?? "";
  }

  const providedSecret = req.headers.get(headerName) ?? "";

  // Fail-closed: secret obrigatório (auditoria SEC-003). Antes aceitávamos
  // crons anônimos como retrocompat — risco de qualquer caller acionar jobs
  // quando o secret não estivesse setado no vault E no env.
  // Retornamos 401 (não 503): ausência de credencial configurada é falha de
  // autorização, não indisponibilidade de serviço. Fail-closed é mantido.
  if (!expectedSecret) {
    logAuthEvent({
      outcome: "denied",
      reason: "secret_not_configured",
      env: secretEnvName,
    });
    return {
      ok: false,
      response: jsonResponse(
        {
          error: "service_misconfigured",
          message: `${secretEnvName} não configurado em vault nem env. Configure antes de invocar este cron.`,
        },
        401,
        corsHeaders,
      ),
    };
  }

  if (!providedSecret) {
    logAuthEvent({ outcome: "denied", reason: "no_cron_secret_provided", env: secretEnvName });
    return {
      ok: false,
      response: jsonResponse(
        { error: "missing_authentication", message: `Header ${headerName} required.` },
        401,
        corsHeaders,
      ),
    };
  }

  if (!constantTimeEqual(providedSecret, expectedSecret)) {
    logAuthEvent({ outcome: "denied", reason: "bad_cron_secret", env: secretEnvName, via_vault: viaVault });
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401, corsHeaders) };
  }

  logAuthEvent({ outcome: "allowed", mode: viaVault ? "secret_vault" : "secret", env: secretEnvName });
  return { ok: true, mode: viaVault ? "secret_vault" : "secret" };
}
