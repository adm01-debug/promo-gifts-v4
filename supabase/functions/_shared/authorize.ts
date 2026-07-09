// supabase/functions/_shared/authorize.ts
// --------------------------------------------------------------
// SSOT para autorização de edges: extrai o usuário do JWT do
// Authorization header e valida role via tabela `user_roles`
// (RLS-safe — usa service_role só para a leitura de role).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "./cors.ts";
import { isTokenRevoked } from "./token-revocation.ts";

// Roles reais em user_roles: 'vendedor' (tier-base), 'admin' (== supervisor),
// 'dev'. 'agente'/'supervisor' sao aliases historicos mantidos por compat.
export type AppRole = "dev" | "supervisor" | "admin" | "agente" | "vendedor";

export interface AuthorizeOptions {
  /** Mínimo exigido (hierárquico). Omita para apenas exigir authenticated. */
  requireRole?: AppRole;
  /** Forçar verificação adicional via has_role() RPC (server-side, RLS-safe). */
  enforceServerSide?: boolean;
}

export type AuthorizeResult =
  | {
      ok: true;
      user: { id: string; email?: string };
      role: AppRole | null;
      token: string;
      supabaseUser: SupabaseClient;
      supabaseAdmin: SupabaseClient;
    }
  | { ok: false; response: Response };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ranking hierarquico. 'vendedor' e 'agente' sao a mesma tier-base (1);
// 'admin' e 'supervisor' sao a mesma tier (2); 'dev' no topo (3).
// BUGFIX: antes faltavam 'vendedor'/'admin' aqui, fazendo ROLE_RANK[role]
// retornar undefined para usuarios reais -> comparacoes NaN instaveis.
const ROLE_RANK: Record<AppRole, number> = {
  vendedor: 1,
  agente: 1,
  supervisor: 2,
  admin: 2,
  dev: 3,
};

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export async function authorize(
  req: Request,
  opts: AuthorizeOptions = {},
): Promise<AuthorizeResult> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "missing_authorization", message: "Authorization header required" },
        401,
        corsHeaders,
      ),
    };
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "missing_token", message: "Bearer token is empty" },
        401,
        corsHeaders,
      ),
    };
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
    return {
      ok: false,
      response: jsonResponse(
        { error: "invalid_token", message: "Token is invalid or expired" },
        401,
        corsHeaders,
      ),
    };
  }

  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? undefined;

  const revoked = await isTokenRevoked(supabaseAdmin, userId, token);
  if (revoked) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "token_revoked", message: "Sessao foi revogada. Faca login novamente." },
        401,
        corsHeaders,
      ),
    };
  }

  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesErr) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "role_lookup_failed", message: "Could not verify user role" },
        500,
        corsHeaders,
      ),
    };
  }

  // Normaliza roles desconhecidas para rank 0 (sem privilegio) de forma segura.
  const rankOf = (r: AppRole | string | null): number =>
    (r != null && r in ROLE_RANK ? ROLE_RANK[r as AppRole] : 0);

  const userRoles = (roles ?? []).map((r) => r.role as AppRole);
  const highestRole: AppRole | null = userRoles.length
    ? (userRoles.reduce((acc, r) => (rankOf(r) > rankOf(acc) ? r : acc), userRoles[0]) as AppRole)
    : null;

  if (opts.requireRole) {
    const requiredRank = rankOf(opts.requireRole);
    const userRank = rankOf(highestRole);
    if (userRank < requiredRank) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "insufficient_role",
            message: `Role '${opts.requireRole}' required (you have '${highestRole ?? "none"}')`,
          },
          403,
          corsHeaders,
        ),
      };
    }

    if (opts.enforceServerSide) {
      const { data: ok, error: rpcErr } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: opts.requireRole,
      });
      if (rpcErr || ok !== true) {
        if (opts.requireRole === "supervisor") {
          const { data: isDev } = await supabaseAdmin.rpc("has_role", {
            _user_id: userId,
            _role: "dev",
          });
          if (isDev === true) {
            return {
              ok: true,
              user: { id: userId, email: userEmail },
              role: highestRole,
              token,
              supabaseUser,
              supabaseAdmin,
            };
          }
        }
        return {
          ok: false,
          response: jsonResponse(
            { error: "insufficient_role_server", message: "Server-side role check failed" },
            403,
            corsHeaders,
          ),
        };
      }
    }
  }

  return {
    ok: true,
    user: { id: userId, email: userEmail },
    role: highestRole,
    token,
    supabaseUser,
    supabaseAdmin,
  };
}
