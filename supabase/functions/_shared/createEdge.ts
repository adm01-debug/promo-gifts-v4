/**
 * createEdge — template unificado para Edge Functions do PromoGifts.
 *
 * Resolve o problema de 4 padrões de auth coexistindo em 83 funções.
 * Novas edges devem usar este template. Migração das existentes é gradual.
 *
 * Modos suportados:
 *   jwt     → JWT obrigatório + verificação de role (usa _shared/auth.ts)
 *   cron    → x-cron-secret timing-safe (usa _shared/dispatcher-auth.ts)
 *   hmac    → HMAC de payload (usar diretamente dispatcher-auth.ts)
 *   public  → sem auth; bot-protection opcional (explicitamente declarado)
 *
 * Uso:
 *   export default createEdge(
 *     { auth: 'jwt', role: 'vendedor' },
 *     async (req, ctx) => {
 *       const { userId, userRole } = ctx;
 *       return new Response(JSON.stringify({ ok: true }), { status: 200 });
 *     }
 *   );
 *
 * Para crons:
 *   export default createEdge(
 *     { auth: 'cron', secretEnv: 'CRON_SECRET' },
 *     async (req, _ctx) => { ... }
 *   );
 */

import { getCorsHeaders, buildPublicCorsHeaders } from "./cors.ts";
import {
  authenticateRequest,
  requireRole,
  authErrorResponse,
  type AuthResult,
} from "./auth.ts";
import { authorizeCron } from "./dispatcher-auth.ts";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

// Roles reais em user_roles: 'vendedor' (tier-base), 'admin' (== supervisor),
// 'dev'. 'agente'/'supervisor' permanecem como aliases historicos aceitos por
// requireRole (ver _shared/auth.ts).
export type EdgeRole = "vendedor" | "agente" | "supervisor" | "admin" | "dev";

export type EdgeConfig =
  | { auth: "jwt"; role?: EdgeRole }
  | { auth: "cron"; secretEnv: string; headerName?: string }
  | { auth: "public" };

export interface EdgeContext {
  /** Presente apenas no modo 'jwt'. */
  user?: Pick<AuthResult, "userId" | "userRole" | "userRoles" | "localServiceClient">;
  corsHeaders: Record<string, string>;
}

export type EdgeHandler = (
  req: Request,
  ctx: EdgeContext,
) => Promise<Response>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEdge(
  config: EdgeConfig,
  handler: EdgeHandler,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // CORS headers — modo public usa buildPublicCorsHeaders
    const corsHeaders =
      config.auth === "public"
        ? buildPublicCorsHeaders()
        : getCorsHeaders(req);

    // Preflight OPTIONS — responde sempre
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
      // ── Modo jwt ──────────────────────────────────────────────────────────
      if (config.auth === "jwt") {
        const auth = await authenticateRequest(req);
        if (config.role) requireRole(auth, config.role);
        return await handler(req, { user: auth, corsHeaders });
      }

      // ── Modo cron ─────────────────────────────────────────────────────────
      if (config.auth === "cron") {
        const result = await authorizeCron(req, {
          corsHeaders,
          secretEnvName: config.secretEnv,
          headerName: config.headerName ?? "x-cron-secret",
        });
        if (!result.ok) return result.response;
        return await handler(req, { corsHeaders });
      }

      // ── Modo public ───────────────────────────────────────────────────────
      return await handler(req, { corsHeaders });

    } catch (err) {
      // Erros lançados por authenticateRequest / requireRole (status + message)
      if ((err as any)?.status) {
        return authErrorResponse(err, corsHeaders);
      }
      // Erros inesperados
      console.error("[createEdge] unhandled error:", err);
      return new Response(
        JSON.stringify({ error: "internal_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: resposta JSON padronizada
// ---------------------------------------------------------------------------

export function jsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
