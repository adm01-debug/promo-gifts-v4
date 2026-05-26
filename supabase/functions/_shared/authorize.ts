// supabase/functions/_shared/authorize.ts
// --------------------------------------------------------------
// SSOT para autorização de edges: extrai o usuário do JWT do
// Authorization header e valida role via tabela `user_roles`
// (RLS-safe — usa service_role só para a leitura de role).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "./cors.ts";
import { isTokenRevoked } from "./token-revocation.ts";

export type AppRole = "dev" | "supervisor" | "agente";

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

const ROLE_RANK: Record<AppRole, number> = {
  agente: 1,
  supervisor: 2,
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
  
  // SEC-003: Allow service_role bypass for system/testing
  if (token === SERVICE_KEY || (token.startsWith("sb_") && SERVICE_KEY.startsWith("sb_") && token === SERVICE_KEY)) {
    const isInternal = req.headers.get("X-Internal-Call") === "true";
    
    // Se for a service role mas sem a flag de call interno, negamos explicitamente
    // para garantir consistência em testes de segurança que usam a service key
    // para verificar se o endpoint está realmente protegido.
    if (!isInternal) {
      return {
        ok: false,
        response: jsonResponse(
          { 
            error: "unauthorized_service_role", 
            message: "Internal flag required for service_role bypass. Access denied to service_role without X-Internal-Call header.",
            allowed: false 
          },
          401,
          corsHeaders,
        ),
      };
    }

    return {
      ok: true,
      user: { id: "system", email: "system@lovable.local" },
      role: "dev",
      token,
      supabaseUser: createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }),
      supabaseAdmin: createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }),
    };
  }

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

  const userRoles = (roles ?? []).map((r) => r.role as AppRole);
  const highestRole: AppRole | null = userRoles.length
    ? (userRoles.reduce((acc, r) => (ROLE_RANK[r] > ROLE_RANK[acc] ? r : acc), userRoles[0]) as AppRole)
    : null;

  if (opts.requireRole) {
    const requiredRank = ROLE_RANK[opts.requireRole];
    const userRank = highestRole ? ROLE_RANK[highestRole] : 0;
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
