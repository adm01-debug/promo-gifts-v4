// supabase/functions/_shared/auth.ts
// Centralized authentication for Edge Functions

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isTokenRevoked } from "./token-revocation.ts";

export interface AuthResult {
  userId: string;
  /** Primeira role retornada (compat). Para checagens, prefira `userRoles` ou `requireDev`. */
  userRole: string;
  /** Todas as roles do usuário (dev, supervisor, agente, admin legado). */
  userRoles: string[];
  localServiceClient: SupabaseClient;
}

/**
 * Authenticate a request using the Authorization header (JWT).
 * Returns the user ID, all roles, and a service-role client for further queries.
 * Throws an object with { status, message } on failure.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw { status: 401, message: 'Token de autenticação ausente' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const simulationKey = Deno.env.get('SIMULATION_BYPASS_KEY');

  const rawToken = authHeader.slice(7).trim();
  const localServiceClient = createClient(supabaseUrl, serviceRoleKey);

  // ⚡ FAST-PATH: Bypasse para chamadas do sistema (service_role ou simulation)
  // Útil para automações, webhooks internos e testes de contrato.
  const isServiceRole = (serviceRoleKey && rawToken === serviceRoleKey.trim());
  const isSimulation = (simulationKey && rawToken === simulationKey.trim());
  
  if (isServiceRole || isSimulation) {
    return {
      userId: '00000000-0000-0000-0000-000000000000', // System user
      userRole: 'dev',
      userRoles: ['dev', 'service_role', 'simulation'],
      localServiceClient
    };
  }

  // Validate token using getUser (works with all supabase-js versions)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error } = await userClient.auth.getUser();

  if (error || !userData?.user) {
    throw { status: 401, message: 'Token inválido ou expirado' };
  }

  // Security Hardening: Validar se a sessão ainda é válida e não foi revogada
  const user = userData.user;
  if (!user.aud || user.aud !== 'authenticated') {
    throw { status: 401, message: 'Audiência de token inválida' };
  }

  const userId = user.id;

  // Onda 15 / item 6.2: bloqueia tokens emitidos antes de uma revogacao.
  const revoked = await isTokenRevoked(localServiceClient, userId, rawToken);
  if (revoked) {
    throw { status: 401, message: 'Sessao foi revogada. Faca login novamente.' };
  }

  const { data: roleRows, error: roleError } = await localServiceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (roleError) {
    console.error('[auth] Error fetching user roles:', roleError.message);
  }

  const userRoles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const userRole = userRoles[0] ?? 'agente';

  return { userId, userRole, userRoles, localServiceClient };
}

/**
 * Hierarquia: dev > supervisor > agente. `admin` é alias legado de supervisor.
 */
function isDevRole(auth: AuthResult): boolean {
  return auth.userRoles.includes('dev') || auth.userRoles.includes('simulation');
}

function isSupervisorOrAbove(auth: AuthResult): boolean {
  return (
    auth.userRoles.includes('dev') ||
    auth.userRoles.includes('simulation') ||
    auth.userRoles.includes('supervisor') ||
    auth.userRoles.includes('admin')
  );
}

/**
 * Require the user to have a specific role.
 */
export function requireRole(auth: AuthResult, requiredRole: string): void {
  if (isDevRole(auth)) return;
  if (requiredRole === 'admin' || requiredRole === 'supervisor') {
    if (isSupervisorOrAbove(auth)) return;
  } else if (auth.userRoles.includes(requiredRole)) {
    return;
  }
  throw { status: 403, message: `Acesso restrito ao papel '${requiredRole}'` };
}

/**
 * Exige papel `dev` — para telemetria, logs técnicos e operações de MCP.
 */
export function requireDev(auth: AuthResult): void {
  if (!isDevRole(auth)) {
    throw { status: 403, message: 'Acesso restrito a desenvolvedores' };
  }
}

/**
 * Helper to create a JSON error response from auth errors.
 */
export function authErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>
): Response {
  const status = (err as any)?.status || 500;
  const message = (err as any)?.message || 'Erro de autenticação';
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
